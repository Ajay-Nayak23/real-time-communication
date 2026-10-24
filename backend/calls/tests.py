from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory
from calls.models import Call
from calls.serializers import CallInitiateSerializer, CallSerializer

User = get_user_model()


class CallModelTests(TestCase):
    """
    Unit tests for Call model and session state transitions (Issue #27 / RTC-024).
    """

    def setUp(self):
        self.caller = User.objects.create_user(
            email="caller@example.com",
            name="Alice Caller",
            password="StrongPassword123!"
        )
        self.callee = User.objects.create_user(
            email="callee@example.com",
            name="Bob Callee",
            password="StrongPassword123!"
        )

    def test_call_creation_default_fields(self):
        """A new call initializes with status 'ringing', type 'audio', and duration 0."""
        call = Call.objects.create(
            caller=self.caller,
            callee=self.callee,
            call_type=Call.CallType.AUDIO
        )

        self.assertIsNotNone(call.id)
        self.assertIsNotNone(call.uuid)
        self.assertEqual(call.status, Call.Status.RINGING)
        self.assertEqual(call.call_type, Call.CallType.AUDIO)
        self.assertEqual(call.duration, 0)
        self.assertIsNone(call.started_at)
        self.assertIsNone(call.ended_at)
        self.assertIn("Call #", str(call))

    def test_call_state_transition_accept_and_end(self):
        """Accepting a call transitions status to ongoing, and ending it computes duration."""
        call = Call.objects.create(
            caller=self.caller,
            callee=self.callee
        )

        # Accept call
        call.mark_accepted()
        self.assertEqual(call.status, Call.Status.ONGOING)
        self.assertIsNotNone(call.started_at)

        # Simulate 45 seconds of call duration
        call.started_at = timezone.now() - timedelta(seconds=45)
        call.save(update_fields=['started_at'])

        # End call
        call.mark_ended()
        self.assertEqual(call.status, Call.Status.ENDED)
        self.assertIsNotNone(call.ended_at)
        self.assertGreaterEqual(call.duration, 44)

    def test_call_state_transition_rejected(self):
        """Rejecting a call sets status to rejected and populates ended_at."""
        call = Call.objects.create(
            caller=self.caller,
            callee=self.callee
        )
        call.mark_rejected()
        self.assertEqual(call.status, Call.Status.REJECTED)
        self.assertIsNotNone(call.ended_at)
        self.assertEqual(call.duration, 0)

    def test_call_state_transition_missed(self):
        """Timing out a call sets status to missed."""
        call = Call.objects.create(
            caller=self.caller,
            callee=self.callee
        )
        call.mark_missed()
        self.assertEqual(call.status, Call.Status.MISSED)
        self.assertIsNotNone(call.ended_at)
        self.assertEqual(call.duration, 0)


class CallSerializerTests(TestCase):
    """
    Unit tests for CallSerializer and CallInitiateSerializer.
    """

    def setUp(self):
        self.caller = User.objects.create_user(
            email="alice.call@example.com",
            name="Alice Call",
            password="StrongPassword123!"
        )
        self.callee = User.objects.create_user(
            email="bob.call@example.com",
            name="Bob Call",
            password="StrongPassword123!"
        )
        self.factory = APIRequestFactory()

    def test_call_serializer_context_other_participant(self):
        """CallSerializer provides caller, callee, and other_participant based on request user."""
        call = Call.objects.create(
            caller=self.caller,
            callee=self.callee,
            call_type=Call.CallType.AUDIO
        )

        # Context as caller
        req = self.factory.get('/')
        req.user = self.caller
        serializer = CallSerializer(call, context={'request': req})
        data = serializer.data

        self.assertEqual(data['id'], call.id)
        self.assertEqual(data['caller']['id'], self.caller.id)
        self.assertEqual(data['callee']['id'], self.callee.id)
        self.assertEqual(data['other_participant']['id'], self.callee.id)

    def test_call_initiate_serializer_validation(self):
        """CallInitiateSerializer validates callee existence and self-calling prevention."""
        req = self.factory.post('/')
        req.user = self.caller

        # Self-call validation failure
        invalid_self = CallInitiateSerializer(
            data={'callee_id': self.caller.id, 'call_type': 'audio'},
            context={'request': req}
        )
        self.assertFalse(invalid_self.is_valid())
        self.assertIn('callee_id', invalid_self.errors)

        # Non-existent callee failure
        invalid_nonexistent = CallInitiateSerializer(
            data={'callee_id': 99999, 'call_type': 'audio'},
            context={'request': req}
        )
        self.assertFalse(invalid_nonexistent.is_valid())
        self.assertIn('callee_id', invalid_nonexistent.errors)

        # Valid payload success
        valid = CallInitiateSerializer(
            data={'callee_id': self.callee.id, 'call_type': 'audio'},
            context={'request': req}
        )
        self.assertTrue(valid.is_valid())
        self.assertEqual(valid.validated_data['callee_id'], self.callee.id)
        self.assertEqual(valid.validated_data['call_type'], 'audio')


class CallSignalingConsumerWebSocketTests(TestCase):
    """
    Automated integration tests for WebRTC CallSignalingConsumer on /ws/calls/ (Issue #28 / RTC-025).
    """

    def setUp(self):
        from channels.testing import WebsocketCommunicator
        from rest_framework_simplejwt.tokens import RefreshToken
        from commute.asgi import application

        self.communicator_cls = WebsocketCommunicator
        self.app = application

        self.user1 = User.objects.create_user(
            email="alice.signaling@example.com",
            name="Alice Signaling",
            password="StrongPassword123!"
        )
        self.user2 = User.objects.create_user(
            email="bob.signaling@example.com",
            name="Bob Signaling",
            password="StrongPassword123!"
        )
        self.user1_token = str(RefreshToken.for_user(self.user1).access_token)
        self.user2_token = str(RefreshToken.for_user(self.user2).access_token)

    async def test_connect_authenticated_success(self):
        """Authenticated user connects to /ws/calls/ and receives confirmation."""
        comm = self.communicator_cls(
            self.app,
            f"/ws/calls/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await comm.connect()
        self.assertTrue(connected)

        msg = await comm.receive_json_from()
        self.assertEqual(msg['type'], 'connection_established')
        self.assertEqual(msg['user_id'], self.user1.id)

        await comm.disconnect()

    async def test_connect_unauthenticated_rejected(self):
        """Connecting without token or invalid token is rejected with 4401."""
        comm = self.communicator_cls(
            self.app,
            "/ws/calls/?token=bad.token.value",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await comm.connect()
        self.assertFalse(connected)
        await comm.disconnect()

    async def test_full_call_signaling_handshake_flow(self):
        """
        Complete signaling flow:
        Alice initiates call -> Bob receives invite -> Bob accepts ->
        Alice receives accept -> Alice sends SDP offer -> Bob receives offer ->
        Bob sends SDP answer -> Alice receives answer -> ICE candidate exchange ->
        Alice ends call -> Bob receives call_ended.
        """
        alice_comm = self.communicator_cls(
            self.app,
            f"/ws/calls/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        bob_comm = self.communicator_cls(
            self.app,
            f"/ws/calls/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )

        await alice_comm.connect()
        await bob_comm.connect()
        await alice_comm.receive_json_from()  # handshake
        await bob_comm.receive_json_from()    # handshake

        # 1. Alice initiates call to Bob
        await alice_comm.send_json_to({
            'type': 'call_initiate',
            'callee_id': self.user2.id,
            'call_type': 'audio'
        })

        # Alice receives confirmation
        alice_init = await alice_comm.receive_json_from()
        self.assertEqual(alice_init['type'], 'call_initiated')
        call_id = alice_init['call_id']

        # Bob receives call invite
        bob_invite = await bob_comm.receive_json_from()
        self.assertEqual(bob_invite['type'], 'call_invite')
        self.assertEqual(bob_invite['call_id'], call_id)
        self.assertEqual(bob_invite['caller_id'], self.user1.id)
        self.assertEqual(bob_invite['call_type'], 'audio')

        # 2. Bob accepts call
        await bob_comm.send_json_to({
            'type': 'call_accept',
            'call_id': call_id
        })

        bob_connected = await bob_comm.receive_json_from()
        self.assertEqual(bob_connected['type'], 'call_connected')

        alice_accepted = await alice_comm.receive_json_from()
        self.assertEqual(alice_accepted['type'], 'call_accepted')
        self.assertEqual(alice_accepted['call_id'], call_id)

        # 3. Alice sends SDP offer
        await alice_comm.send_json_to({
            'type': 'sdp_offer',
            'call_id': call_id,
            'payload': {'type': 'offer', 'sdp': 'mock-sdp-offer-string'}
        })

        bob_offer = await bob_comm.receive_json_from()
        self.assertEqual(bob_offer['type'], 'sdp_offer')
        self.assertEqual(bob_offer['payload']['sdp'], 'mock-sdp-offer-string')

        # 4. Bob sends SDP answer
        await bob_comm.send_json_to({
            'type': 'sdp_answer',
            'call_id': call_id,
            'payload': {'type': 'answer', 'sdp': 'mock-sdp-answer-string'}
        })

        alice_answer = await alice_comm.receive_json_from()
        self.assertEqual(alice_answer['type'], 'sdp_answer')
        self.assertEqual(alice_answer['payload']['sdp'], 'mock-sdp-answer-string')

        # 5. ICE candidate exchange
        await alice_comm.send_json_to({
            'type': 'ice_candidate',
            'call_id': call_id,
            'payload': {'candidate': 'candidate:1 1 UDP ...', 'sdpMid': '0', 'sdpMLineIndex': 0}
        })

        bob_candidate = await bob_comm.receive_json_from()
        self.assertEqual(bob_candidate['type'], 'ice_candidate')
        self.assertEqual(bob_candidate['payload']['sdpMid'], '0')

        # 6. Alice ends call
        await alice_comm.send_json_to({
            'type': 'call_end',
            'call_id': call_id,
            'reason': 'completed'
        })

        alice_ended = await alice_comm.receive_json_from()
        self.assertEqual(alice_ended['type'], 'call_ended')

        bob_ended = await bob_comm.receive_json_from()
        self.assertEqual(bob_ended['type'], 'call_ended')
        self.assertEqual(bob_ended['call_id'], call_id)

        # Verify DB updated
        call = await Call.objects.aget(id=call_id)
        self.assertEqual(call.status, Call.Status.ENDED)

        await alice_comm.disconnect()
        await bob_comm.disconnect()

    async def test_call_reject_flow(self):
        """Callee can reject call; Caller receives call_rejected and DB status becomes rejected."""
        alice_comm = self.communicator_cls(
            self.app,
            f"/ws/calls/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        bob_comm = self.communicator_cls(
            self.app,
            f"/ws/calls/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )

        await alice_comm.connect()
        await bob_comm.connect()
        await alice_comm.receive_json_from()
        await bob_comm.receive_json_from()

        await alice_comm.send_json_to({
            'type': 'call_initiate',
            'callee_id': self.user2.id,
            'call_type': 'audio'
        })
        alice_init = await alice_comm.receive_json_from()
        call_id = alice_init['call_id']
        await bob_comm.receive_json_from()  # call_invite

        # Bob rejects
        await bob_comm.send_json_to({
            'type': 'call_reject',
            'call_id': call_id,
            'reason': 'busy'
        })

        alice_rejected = await alice_comm.receive_json_from()
        self.assertEqual(alice_rejected['type'], 'call_rejected')
        self.assertEqual(alice_rejected['call_id'], call_id)
        self.assertEqual(alice_rejected['reason'], 'busy')

        call = await Call.objects.aget(id=call_id)
        self.assertEqual(call.status, Call.Status.REJECTED)

        await alice_comm.disconnect()
        await bob_comm.disconnect()
