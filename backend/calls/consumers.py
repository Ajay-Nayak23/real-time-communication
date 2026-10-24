import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone
from calls.models import Call

User = get_user_model()


class CallSignalingConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for WebRTC signaling, call session state dispatch,
    SDP offer/answer exchange, and ICE candidate delivery.
    Listens on `/ws/calls/`.
    Authenticated via JWT query parameter or Authorization header.
    """

    async def connect(self):
        self.user = self.scope.get('user')

        # 1. Enforce authentication
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        # 2. Join the user's personal signaling group (user_<id>)
        self.user_group = f"user_{self.user.id}"
        await self.channel_layer.group_add(self.user_group, self.channel_name)

        self.current_call_group = None

        await self.accept()

        # Send handshake confirmation
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'user_id': self.user.id,
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'user_group'):
            await self.channel_layer.group_discard(self.user_group, self.channel_name)

        if getattr(self, 'current_call_group', None):
            await self.channel_layer.group_discard(self.current_call_group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        if not text_data:
            return

        try:
            payload = json.loads(text_data)
        except json.JSONDecodeError:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid JSON format.',
            }))
            return

        event_type = payload.get('type') or payload.get('action')

        if event_type == 'call_initiate':
            await self.handle_call_initiate(payload)
        elif event_type == 'call_accept':
            await self.handle_call_accept(payload)
        elif event_type == 'call_reject':
            await self.handle_call_reject(payload)
        elif event_type == 'sdp_offer':
            await self.handle_sdp_offer(payload)
        elif event_type == 'sdp_answer':
            await self.handle_sdp_answer(payload)
        elif event_type == 'ice_candidate':
            await self.handle_ice_candidate(payload)
        elif event_type == 'call_end':
            await self.handle_call_end(payload)
        elif event_type in ['ping', 'heartbeat']:
            await self.send(text_data=json.dumps({'type': 'pong'}))

    # --- Event Handlers ---

    async def handle_call_initiate(self, payload):
        callee_id = payload.get('callee_id')
        call_type = payload.get('call_type', Call.CallType.AUDIO)

        if not callee_id or int(callee_id) == self.user.id:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Invalid callee ID.',
            }))
            return

        callee_exists = await self.check_user_exists(callee_id)
        if not callee_exists:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Target user not found.',
            }))
            return

        # Create Call record in DB
        call = await self.create_call_record(self.user.id, int(callee_id), call_type)

        # Join call group
        self.current_call_group = f"call_{call['id']}"
        await self.channel_layer.group_add(self.current_call_group, self.channel_name)

        # Acknowledge caller
        await self.send(text_data=json.dumps({
            'type': 'call_initiated',
            'call_id': call['id'],
            'callee_id': int(callee_id),
            'call_type': call['call_type'],
        }))

        # Send call invite to callee's personal group
        await self.channel_layer.group_send(
            f"user_{callee_id}",
            {
                'type': 'call_invite_signal',
                'call_id': call['id'],
                'caller_id': self.user.id,
                'caller_name': self.user.name or self.user.email.split('@')[0],
                'caller_avatar': self.user.profile_image,
                'call_type': call['call_type'],
                'created_at': call['created_at'],
            }
        )

    async def handle_call_accept(self, payload):
        call_id = payload.get('call_id')
        if not call_id:
            return

        call = await self.db_mark_call_accepted(call_id, self.user.id)
        if not call:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': 'Call not found or unauthorized.',
            }))
            return

        # Join call group
        self.current_call_group = f"call_{call['id']}"
        await self.channel_layer.group_add(self.current_call_group, self.channel_name)

        # Notify caller that callee accepted
        await self.channel_layer.group_send(
            f"user_{call['caller_id']}",
            {
                'type': 'call_accepted_signal',
                'call_id': call['id'],
                'callee_id': self.user.id,
                'started_at': call['started_at'],
            }
        )

        # Acknowledge acceptance to callee
        await self.send(text_data=json.dumps({
            'type': 'call_connected',
            'call_id': call['id'],
            'partner_id': call['caller_id'],
            'started_at': call['started_at'],
        }))

    async def handle_call_reject(self, payload):
        call_id = payload.get('call_id')
        reason = payload.get('reason', 'declined')
        if not call_id:
            return

        call = await self.db_mark_call_rejected(call_id, self.user.id)
        if not call:
            return

        await self.channel_layer.group_send(
            f"user_{call['caller_id']}",
            {
                'type': 'call_rejected_signal',
                'call_id': call['id'],
                'reason': reason,
            }
        )

    async def handle_sdp_offer(self, payload):
        call_id = payload.get('call_id')
        sdp_data = payload.get('payload') or payload.get('sdp')
        if not call_id or not sdp_data:
            return

        call = await self.get_call_participants(call_id)
        if not call or self.user.id not in [call['caller_id'], call['callee_id']]:
            return

        target_id = call['callee_id'] if self.user.id == call['caller_id'] else call['caller_id']
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {
                'type': 'sdp_offer_signal',
                'call_id': call_id,
                'sender_id': self.user.id,
                'payload': sdp_data,
            }
        )

    async def handle_sdp_answer(self, payload):
        call_id = payload.get('call_id')
        sdp_data = payload.get('payload') or payload.get('sdp')
        if not call_id or not sdp_data:
            return

        call = await self.get_call_participants(call_id)
        if not call or self.user.id not in [call['caller_id'], call['callee_id']]:
            return

        target_id = call['caller_id'] if self.user.id == call['callee_id'] else call['callee_id']
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {
                'type': 'sdp_answer_signal',
                'call_id': call_id,
                'sender_id': self.user.id,
                'payload': sdp_data,
            }
        )

    async def handle_ice_candidate(self, payload):
        call_id = payload.get('call_id')
        candidate_data = payload.get('payload') or payload.get('candidate')
        if not call_id or not candidate_data:
            return

        call = await self.get_call_participants(call_id)
        if not call or self.user.id not in [call['caller_id'], call['callee_id']]:
            return

        target_id = call['callee_id'] if self.user.id == call['caller_id'] else call['caller_id']
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {
                'type': 'ice_candidate_signal',
                'call_id': call_id,
                'sender_id': self.user.id,
                'payload': candidate_data,
            }
        )

    async def handle_call_end(self, payload):
        call_id = payload.get('call_id')
        reason = payload.get('reason', 'completed')
        if not call_id:
            return

        call = await self.db_mark_call_ended(call_id, self.user.id)
        if not call:
            return

        target_id = call['callee_id'] if self.user.id == call['caller_id'] else call['caller_id']
        await self.channel_layer.group_send(
            f"user_{target_id}",
            {
                'type': 'call_ended_signal',
                'call_id': call['id'],
                'duration': call['duration'],
                'reason': reason,
            }
        )

        # Notify the sender as well
        await self.send(text_data=json.dumps({
            'type': 'call_ended',
            'call_id': call['id'],
            'duration': call['duration'],
            'reason': reason,
        }))

    # --- Channel Layer Signal Dispatchers to Client ---

    async def call_invite_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'call_invite',
            'call_id': event['call_id'],
            'caller_id': event['caller_id'],
            'caller_name': event['caller_name'],
            'caller_avatar': event.get('caller_avatar'),
            'call_type': event['call_type'],
            'created_at': event['created_at'],
        }))

    async def call_accepted_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'call_accepted',
            'call_id': event['call_id'],
            'callee_id': event['callee_id'],
            'started_at': event['started_at'],
        }))

    async def call_rejected_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'call_rejected',
            'call_id': event['call_id'],
            'reason': event.get('reason', 'declined'),
        }))

    async def sdp_offer_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'sdp_offer',
            'call_id': event['call_id'],
            'sender_id': event['sender_id'],
            'payload': event['payload'],
        }))

    async def sdp_answer_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'sdp_answer',
            'call_id': event['call_id'],
            'sender_id': event['sender_id'],
            'payload': event['payload'],
        }))

    async def ice_candidate_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'ice_candidate',
            'call_id': event['call_id'],
            'sender_id': event['sender_id'],
            'payload': event['payload'],
        }))

    async def call_ended_signal(self, event):
        await self.send(text_data=json.dumps({
            'type': 'call_ended',
            'call_id': event['call_id'],
            'duration': event.get('duration', 0),
            'reason': event.get('reason', 'completed'),
        }))

    # --- Database Helpers ---

    @database_sync_to_async
    def check_user_exists(self, user_id):
        return User.objects.filter(id=user_id, is_active=True).exists()

    @database_sync_to_async
    def create_call_record(self, caller_id, callee_id, call_type):
        call = Call.objects.create(
            caller_id=caller_id,
            callee_id=callee_id,
            call_type=call_type,
            status=Call.Status.RINGING
        )
        return {
            'id': call.id,
            'caller_id': call.caller_id,
            'callee_id': call.callee_id,
            'call_type': call.call_type,
            'created_at': call.created_at.isoformat(),
        }

    @database_sync_to_async
    def db_mark_call_accepted(self, call_id, user_id):
        call = Call.objects.filter(id=call_id, callee_id=user_id).first()
        if not call:
            return None
        call.mark_accepted()
        return {
            'id': call.id,
            'caller_id': call.caller_id,
            'callee_id': call.callee_id,
            'started_at': call.started_at.isoformat(),
        }

    @database_sync_to_async
    def db_mark_call_rejected(self, call_id, user_id):
        call = Call.objects.filter(id=call_id, callee_id=user_id).first()
        if not call:
            return None
        call.mark_rejected()
        return {
            'id': call.id,
            'caller_id': call.caller_id,
            'callee_id': call.callee_id,
        }

    @database_sync_to_async
    def db_mark_call_ended(self, call_id, user_id):
        call = Call.objects.filter(id=call_id).first()
        if not call or user_id not in [call.caller_id, call.callee_id]:
            return None
        call.mark_ended()
        return {
            'id': call.id,
            'caller_id': call.caller_id,
            'callee_id': call.callee_id,
            'duration': call.duration,
        }

    @database_sync_to_async
    def get_call_participants(self, call_id):
        call = Call.objects.filter(id=call_id).first()
        if not call:
            return None
        return {
            'id': call.id,
            'caller_id': call.caller_id,
            'callee_id': call.callee_id,
        }
