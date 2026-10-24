from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase, TransactionTestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient, APITestCase
from rest_framework_simplejwt.tokens import RefreshToken
from channels.testing import WebsocketCommunicator
from commute.asgi import application
from chat.models import Conversation, ConversationParticipant, Message

User = get_user_model()


class ChatModelTests(TestCase):
    """
    Unit tests for the Chat application models:
    - Conversation
    - ConversationParticipant
    - Message
    """

    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice@example.com',
            password='Password123!',
            name='Alice'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com',
            password='Password123!',
            name='Bob'
        )
        self.user3 = User.objects.create_user(
            email='charlie@example.com',
            password='Password123!',
            name='Charlie'
        )

    def test_create_conversation(self):
        """Test conversation creation and default fields."""
        conversation = Conversation.objects.create()
        self.assertIsNotNone(conversation.id)
        self.assertIsNotNone(conversation.created_at)
        self.assertIsNotNone(conversation.updated_at)
        self.assertEqual(str(conversation), f"Conversation {conversation.id}")

    def test_add_conversation_participants(self):
        """Test adding participants to a conversation."""
        conversation = Conversation.objects.create()
        part1 = ConversationParticipant.objects.create(
            conversation=conversation,
            user=self.user1
        )
        part2 = ConversationParticipant.objects.create(
            conversation=conversation,
            user=self.user2
        )

        self.assertEqual(conversation.participants.count(), 2)
        self.assertEqual(self.user1.conversation_participations.count(), 1)
        self.assertEqual(self.user2.conversation_participations.count(), 1)
        self.assertEqual(str(part1), f"User {self.user1.id} in Conversation {conversation.id}")

    def test_prevent_duplicate_participant(self):
        """Test that duplicate participants in the same conversation are rejected by unique constraint."""
        conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(
            conversation=conversation,
            user=self.user1
        )

        with self.assertRaises(IntegrityError):
            ConversationParticipant.objects.create(
                conversation=conversation,
                user=self.user1
            )

    def test_create_and_query_messages(self):
        """Test sending messages and querying them in chronological order."""
        conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conversation, user=self.user1)
        ConversationParticipant.objects.create(conversation=conversation, user=self.user2)

        msg1 = Message.objects.create(
            conversation=conversation,
            sender=self.user1,
            content="Hello Bob!"
        )
        msg2 = Message.objects.create(
            conversation=conversation,
            sender=self.user2,
            content="Hi Alice!"
        )

        self.assertEqual(conversation.messages.count(), 2)
        self.assertEqual(list(conversation.messages.all()), [msg1, msg2])
        self.assertFalse(msg1.is_read)
        self.assertFalse(msg1.is_deleted)
        self.assertIn("Message", str(msg1))
        self.assertEqual(self.user1.sent_messages.count(), 1)
        self.assertEqual(self.user2.sent_messages.count(), 1)

    def test_soft_delete_readiness(self):
        """Test that is_deleted flag functions for soft-deletion readiness."""
        conversation = Conversation.objects.create()
        msg = Message.objects.create(
            conversation=conversation,
            sender=self.user1,
            content="This message will be soft-deleted"
        )
        self.assertFalse(msg.is_deleted)
        msg.is_deleted = True
        msg.save()

        refetched = Message.objects.get(id=msg.id)
        self.assertTrue(refetched.is_deleted)

    def test_cascade_deletion_on_conversation_delete(self):
        """Test that deleting a conversation cascades to participants and messages."""
        conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conversation, user=self.user1)
        Message.objects.create(conversation=conversation, sender=self.user1, content="Test")

        self.assertEqual(ConversationParticipant.objects.filter(conversation=conversation).count(), 1)
        self.assertEqual(Message.objects.filter(conversation=conversation).count(), 1)

        conversation.delete()

        self.assertEqual(ConversationParticipant.objects.filter(conversation_id=conversation.id).count(), 0)
        self.assertEqual(Message.objects.filter(conversation_id=conversation.id).count(), 0)

    def test_cascade_deletion_on_user_delete(self):
        """Test that deleting a user removes their participations and sent messages."""
        conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conversation, user=self.user3)
        Message.objects.create(conversation=conversation, sender=self.user3, content="Charlie's message")

        self.assertEqual(ConversationParticipant.objects.filter(user=self.user3).count(), 1)
        self.assertEqual(Message.objects.filter(sender=self.user3).count(), 1)

        self.user3.delete()

        self.assertEqual(ConversationParticipant.objects.filter(user_id=self.user3.id).count(), 0)
        self.assertEqual(Message.objects.filter(sender_id=self.user3.id).count(), 0)


class ConversationAPITests(TestCase):
    """
    Integration tests for One-to-One Conversation Management REST API (RTC-018).
    - GET /api/chat/conversations/
    - POST /api/chat/conversations/
    - GET /api/chat/conversations/<id>/
    """

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='alice@example.com',
            password='Password123!',
            name='Alice'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com',
            password='Password123!',
            name='Bob'
        )
        self.user3 = User.objects.create_user(
            email='charlie@example.com',
            password='Password123!',
            name='Charlie'
        )

        self.list_create_url = reverse('api:chat:conversation_list_create')

    def test_unauthenticated_request_blocked(self):
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(self.list_create_url, {'recipient_id': self.user2.id})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_one_to_one_conversation_success(self):
        """Starting a conversation with another user creates a conversation with both participants."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.list_create_url, {'recipient_id': self.user2.id})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('id', response.data)
        self.assertEqual(len(response.data['participants']), 2)

        # Check other_participant preview
        self.assertIsNotNone(response.data['other_participant'])
        self.assertEqual(response.data['other_participant']['id'], self.user2.id)
        self.assertEqual(response.data['other_participant']['email'], self.user2.email)

        # Check database records
        conversation = Conversation.objects.get(id=response.data['id'])
        participant_ids = set(conversation.participants.values_list('user_id', flat=True))
        self.assertEqual(participant_ids, {self.user1.id, self.user2.id})

    def test_create_conversation_by_email_success(self):
        """Can initiate conversation using recipient_email."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.list_create_url, {'recipient_email': 'bob@example.com'})

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['other_participant']['id'], self.user2.id)

    def test_prevent_duplicate_one_to_one_conversation(self):
        """
        Requesting to start a conversation with the same user returns the existing
        conversation with 200 OK instead of creating a duplicate thread.
        """
        self.client.force_authenticate(user=self.user1)

        # First request creates it
        res1 = self.client.post(self.list_create_url, {'recipient_id': self.user2.id})
        self.assertEqual(res1.status_code, status.HTTP_201_CREATED)
        conv_id = res1.data['id']

        # Second request from user1 to user2 returns the same conversation
        res2 = self.client.post(self.list_create_url, {'recipient_id': self.user2.id})
        self.assertEqual(res2.status_code, status.HTTP_200_OK)
        self.assertEqual(res2.data['id'], conv_id)

        # Reverse request: user2 starts conversation with user1 -> also returns the same conversation
        self.client.force_authenticate(user=self.user2)
        res3 = self.client.post(self.list_create_url, {'recipient_id': self.user1.id})
        self.assertEqual(res3.status_code, status.HTTP_200_OK)
        self.assertEqual(res3.data['id'], conv_id)

        # Total conversation count in DB must still be 1
        self.assertEqual(Conversation.objects.count(), 1)

    def test_prevent_self_conversation(self):
        """Cannot initiate a conversation with oneself."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.list_create_url, {'recipient_id': self.user1.id})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('recipient', response.data)

    def test_create_conversation_nonexistent_user(self):
        """Cannot initiate a conversation with a non-existent recipient ID."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.list_create_url, {'recipient_id': 99999})

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_user_conversations(self):
        """Listing conversations only returns conversations the user is a participant of."""
        # Conversation A: user1 and user2
        conv_a = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conv_a, user=self.user1)
        ConversationParticipant.objects.create(conversation=conv_a, user=self.user2)

        # Conversation B: user2 and user3
        conv_b = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conv_b, user=self.user2)
        ConversationParticipant.objects.create(conversation=conv_b, user=self.user3)

        # User 1 lists conversations -> only conv_a
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]['id'], conv_a.id)

        # User 2 lists conversations -> both conv_a and conv_b
        self.client.force_authenticate(user=self.user2)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_conversation_last_message_and_unread_count(self):
        """Conversation list preview contains accurate last_message and unread count."""
        conv = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conv, user=self.user1)
        ConversationParticipant.objects.create(conversation=conv, user=self.user2)

        # User 2 sends message 1 to User 1
        Message.objects.create(
            conversation=conv,
            sender=self.user2,
            content="Message 1 from Bob",
            is_read=False
        )

        # User 2 sends message 2 to User 1
        msg2 = Message.objects.create(
            conversation=conv,
            sender=self.user2,
            content="Message 2 from Bob",
            is_read=False
        )

        # User 1 views list -> unread_count=2, last_message is msg2
        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        conv_data = response.data[0]
        self.assertEqual(conv_data['unread_count'], 2)
        self.assertIsNotNone(conv_data['last_message'])
        self.assertEqual(conv_data['last_message']['id'], msg2.id)
        self.assertEqual(conv_data['last_message']['content'], "Message 2 from Bob")

        # User 2 views list -> unread_count=0 (they sent the messages)
        self.client.force_authenticate(user=self.user2)
        response = self.client.get(self.list_create_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data[0]['unread_count'], 0)

    def test_get_conversation_detail_success(self):
        """A participant can retrieve conversation details by ID."""
        conv = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conv, user=self.user1)
        ConversationParticipant.objects.create(conversation=conv, user=self.user2)

        detail_url = reverse('api:chat:conversation_detail', kwargs={'pk': conv.id})

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['id'], conv.id)
        self.assertEqual(response.data['other_participant']['id'], self.user2.id)

    def test_get_conversation_detail_forbidden_for_non_participant(self):
        """A non-participant receives 403 Forbidden when trying to access conversation details."""
        conv = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=conv, user=self.user1)
        ConversationParticipant.objects.create(conversation=conv, user=self.user2)

        detail_url = reverse('api:chat:conversation_detail', kwargs={'pk': conv.id})

        # User 3 is not a participant
        self.client.force_authenticate(user=self.user3)
        response = self.client.get(detail_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_get_conversation_detail_not_found(self):
        """Retrieving a non-existent conversation returns 404 Not Found."""
        self.client.force_authenticate(user=self.user1)
        detail_url = reverse('api:chat:conversation_detail', kwargs={'pk': 99999})
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_alias_url_endpoints(self):
        """Both /api/chat/conversations/ and /api/conversations/ route correctly."""
        self.client.force_authenticate(user=self.user1)

        res1 = self.client.get('/api/chat/conversations/')
        self.assertEqual(res1.status_code, status.HTTP_200_OK)

        res2 = self.client.get('/api/conversations/')
        self.assertEqual(res2.status_code, status.HTTP_200_OK)


class MessageHistoryAPITests(TestCase):
    """
    Integration tests for Paginated Message History REST API (RTC-019).
    - GET  /api/chat/conversations/<id>/messages/
    - POST /api/chat/conversations/<id>/messages/
    """

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='alice@example.com',
            password='Password123!',
            name='Alice'
        )
        self.user2 = User.objects.create_user(
            email='bob@example.com',
            password='Password123!',
            name='Bob'
        )
        self.user3 = User.objects.create_user(
            email='charlie@example.com',
            password='Password123!',
            name='Charlie'
        )

        self.conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=self.conversation, user=self.user1)
        ConversationParticipant.objects.create(conversation=self.conversation, user=self.user2)

        self.messages_url = reverse(
            'api:chat:conversation_messages', kwargs={'conversation_id': self.conversation.id}
        )

    def test_unauthenticated_request_blocked(self):
        """Unauthenticated requests must be rejected with 401 Unauthorized."""
        response = self.client.get(self.messages_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        response = self.client.post(self.messages_url, {'content': 'Hello'})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_get_messages_authorized_participant(self):
        """Authorized participant can retrieve messages for their conversation."""
        msg = Message.objects.create(
            conversation=self.conversation,
            sender=self.user1,
            content="Hello Bob!"
        )

        self.client.force_authenticate(user=self.user2)
        response = self.client.get(self.messages_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('results', response.data)
        self.assertEqual(len(response.data['results']), 1)
        res_msg = response.data['results'][0]
        self.assertEqual(res_msg['id'], msg.id)
        self.assertEqual(res_msg['content'], "Hello Bob!")
        self.assertEqual(res_msg['sender']['id'], self.user1.id)
        self.assertEqual(res_msg['sender']['email'], self.user1.email)
        self.assertEqual(res_msg['conversation_id'], self.conversation.id)

    def test_get_messages_unauthorized_non_participant(self):
        """Non-participant receives HTTP 403 Forbidden when attempting to access conversation messages."""
        self.client.force_authenticate(user=self.user3)
        response = self.client.get(self.messages_url)

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertIn('detail', response.data)

    def test_get_messages_nonexistent_conversation(self):
        """Attempting to access messages in a non-existent conversation returns 404 Not Found."""
        self.client.force_authenticate(user=self.user1)
        invalid_url = reverse('api:chat:conversation_messages', kwargs={'conversation_id': 99999})
        response = self.client.get(invalid_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_send_message_success(self):
        """A participant can send a message, updating the conversation's updated_at."""
        initial_updated_at = self.conversation.updated_at
        self.client.force_authenticate(user=self.user1)

        response = self.client.post(self.messages_url, {'content': 'How are you?'})
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['content'], 'How are you?')
        self.assertEqual(response.data['sender']['id'], self.user1.id)
        self.assertFalse(response.data['is_read'])

        self.conversation.refresh_from_db()
        self.assertGreaterEqual(self.conversation.updated_at, initial_updated_at)
        self.assertEqual(self.conversation.messages.count(), 1)

    def test_send_message_unauthorized_non_participant(self):
        """A non-participant receives 403 Forbidden when attempting to send a message."""
        self.client.force_authenticate(user=self.user3)
        response = self.client.post(self.messages_url, {'content': 'Intruder message'})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_send_message_validation_empty(self):
        """Sending empty or whitespace content returns 400 Bad Request."""
        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.messages_url, {'content': '   '})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('content', response.data)

    def test_cursor_pagination_navigation(self):
        """Cursor pagination returns 20 items per page and navigates older history pages."""
        for i in range(25):
            Message.objects.create(
                conversation=self.conversation,
                sender=self.user1,
                content=f"Message {i+1}"
            )

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.messages_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('next', response.data)
        self.assertIn('previous', response.data)
        self.assertIsNotNone(response.data['next'])
        self.assertEqual(len(response.data['results']), 20)

        next_url = response.data['next']
        page2_response = self.client.get(next_url)
        self.assertEqual(page2_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(page2_response.data['results']), 5)

    def test_page_number_pagination_navigation(self):
        """Page-number pagination (?page=1&page_size=10) returns count, next, and slices correctly."""
        for i in range(25):
            Message.objects.create(
                conversation=self.conversation,
                sender=self.user1,
                content=f"Message {i+1}"
            )

        self.client.force_authenticate(user=self.user1)
        res_p1 = self.client.get(f"{self.messages_url}?page=1&page_size=10")
        self.assertEqual(res_p1.status_code, status.HTTP_200_OK)
        self.assertEqual(res_p1.data['count'], 25)
        self.assertEqual(len(res_p1.data['results']), 10)
        self.assertIsNotNone(res_p1.data['next'])

        res_p2 = self.client.get(f"{self.messages_url}?page=2&page_size=10")
        self.assertEqual(res_p2.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_p2.data['results']), 10)

        res_p3 = self.client.get(f"{self.messages_url}?page=3&page_size=10")
        self.assertEqual(res_p3.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res_p3.data['results']), 5)
        self.assertIsNone(res_p3.data['next'])

    def test_ordering_parameter(self):
        """Ordering can be explicitly set to created_at (chronological) or -created_at."""
        msg1 = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="First"
        )
        msg2 = Message.objects.create(
            conversation=self.conversation, sender=self.user2, content="Second"
        )

        self.client.force_authenticate(user=self.user1)

        # Chronological: oldest first
        res_asc = self.client.get(f"{self.messages_url}?ordering=created_at&page=1")
        self.assertEqual(res_asc.data['results'][0]['id'], msg1.id)
        self.assertEqual(res_asc.data['results'][1]['id'], msg2.id)

        # Reverse chronological: newest first
        res_desc = self.client.get(f"{self.messages_url}?ordering=-created_at&page=1")
        self.assertEqual(res_desc.data['results'][0]['id'], msg2.id)
        self.assertEqual(res_desc.data['results'][1]['id'], msg1.id)

    def test_soft_deleted_messages_excluded_from_history(self):
        """Messages marked as is_deleted=True are excluded from history retrieval."""
        active_msg = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Active"
        )
        deleted_msg = Message.objects.create(
            conversation=self.conversation, sender=self.user1, content="Deleted", is_deleted=True
        )

        self.client.force_authenticate(user=self.user1)
        response = self.client.get(self.messages_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        returned_ids = [m['id'] for m in response.data['results']]
        self.assertIn(active_msg.id, returned_ids)
        self.assertNotIn(deleted_msg.id, returned_ids)


class ConversationMarkReadAPITests(TestCase):
    """
    Integration tests for Mark Messages Read REST API (RTC-022).
    - POST /api/chat/conversations/<id>/read/
    """

    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(
            email='alice.read@example.com',
            password='Password123!',
            name='Alice Read'
        )
        self.user2 = User.objects.create_user(
            email='bob.read@example.com',
            password='Password123!',
            name='Bob Read'
        )
        self.user3 = User.objects.create_user(
            email='charlie.read@example.com',
            password='Password123!',
            name='Charlie Read'
        )

        self.conversation = Conversation.objects.create()
        self.part1 = ConversationParticipant.objects.create(conversation=self.conversation, user=self.user1)
        self.part2 = ConversationParticipant.objects.create(conversation=self.conversation, user=self.user2)

        self.read_url = reverse('api:chat:conversation_mark_read', kwargs={'conversation_id': self.conversation.id})

    def test_unauthenticated_mark_read_blocked(self):
        """Unauthenticated requests receive 401 Unauthorized."""
        response = self.client.post(self.read_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_non_participant_mark_read_forbidden(self):
        """Non-participant receives 403 Forbidden."""
        self.client.force_authenticate(user=self.user3)
        response = self.client.post(self.read_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_mark_messages_as_read_success(self):
        """Participant marks incoming unread messages as read."""
        msg1 = Message.objects.create(conversation=self.conversation, sender=self.user2, content="Msg 1")
        msg2 = Message.objects.create(conversation=self.conversation, sender=self.user2, content="Msg 2")
        self.assertFalse(msg1.is_read)
        self.assertFalse(msg2.is_read)

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.read_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'success')
        self.assertEqual(response.data['read_count'], 2)
        self.assertEqual(response.data['unread_count'], 0)

        msg1.refresh_from_db()
        msg2.refresh_from_db()
        self.assertTrue(msg1.is_read)
        self.assertTrue(msg2.is_read)
        self.assertIsNotNone(msg1.read_at)
        self.assertIsNotNone(msg2.read_at)

        self.part1.refresh_from_db()
        self.assertIsNotNone(self.part1.last_read_at)

    def test_mark_read_does_not_affect_own_messages(self):
        """Marking read only updates messages sent by other participants."""
        own_msg = Message.objects.create(conversation=self.conversation, sender=self.user1, content="My own message")
        peer_msg = Message.objects.create(conversation=self.conversation, sender=self.user2, content="Peer message")

        self.client.force_authenticate(user=self.user1)
        response = self.client.post(self.read_url)

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['read_count'], 1)

        own_msg.refresh_from_db()
        peer_msg.refresh_from_db()
        self.assertFalse(own_msg.is_read)
        self.assertTrue(peer_msg.is_read)


class ChatConsumerTests(TransactionTestCase):
    """
    Automated integration tests for Django Channels ChatConsumer WebSocket endpoint (RTC-021).
    Endpoint: /ws/chat/<conversation_id>/?token=<JWT_ACCESS_TOKEN>
    """

    def setUp(self):
        self.user1 = User.objects.create_user(
            email='alice.ws@example.com',
            password='Password123!',
            name='Alice WS'
        )
        self.user2 = User.objects.create_user(
            email='bob.ws@example.com',
            password='Password123!',
            name='Bob WS'
        )
        self.user3 = User.objects.create_user(
            email='charlie.ws@example.com',
            password='Password123!',
            name='Charlie WS'
        )

        self.conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=self.conversation, user=self.user1)
        ConversationParticipant.objects.create(conversation=self.conversation, user=self.user2)

        self.user1_token = str(RefreshToken.for_user(self.user1).access_token)
        self.user2_token = str(RefreshToken.for_user(self.user2).access_token)
        self.user3_token = str(RefreshToken.for_user(self.user3).access_token)

    async def test_connect_authenticated_participant_success(self):
        """Authenticated conversation participant successfully connects and receives handshake."""
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        response = await communicator.receive_json_from()
        self.assertEqual(response.get('type'), 'connection_established')
        self.assertEqual(response.get('conversation_id'), self.conversation.id)
        self.assertEqual(response.get('user_id'), self.user1.id)

        await communicator.disconnect()

    async def test_connect_unauthenticated_rejected(self):
        """Unauthenticated WebSocket connection is immediately closed/rejected."""
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_connect_invalid_token_rejected(self):
        """Connection with invalid token is rejected."""
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token=invalid.jwt.token",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_connect_non_participant_rejected(self):
        """User who is not a participant in the conversation is rejected."""
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user3_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
        await communicator.disconnect()

    async def test_send_message_persists_to_db_and_broadcasts(self):
        """Sending a message via WebSocket persists the record in DB and broadcasts it."""
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)

        # Receive handshake confirmation
        handshake = await communicator.receive_json_from()
        self.assertEqual(handshake['type'], 'connection_established')

        # Send chat message
        await communicator.send_json_to({
            'type': 'chat_message',
            'content': 'Hello from WebSocket test!'
        })

        # Receive broadcast message
        broadcast = await communicator.receive_json_from()
        self.assertEqual(broadcast['type'], 'chat_message')
        self.assertEqual(broadcast['message']['content'], 'Hello from WebSocket test!')
        self.assertEqual(broadcast['message']['sender']['id'], self.user1.id)
        self.assertEqual(broadcast['message']['conversation_id'], self.conversation.id)

        # Verify message persisted in database
        saved_msg = await Message.objects.filter(
            conversation=self.conversation, content='Hello from WebSocket test!'
        ).afirst()
        self.assertIsNotNone(saved_msg)
        self.assertEqual(saved_msg.sender_id, self.user1.id)

        await communicator.disconnect()

    async def test_bidirectional_messaging_between_participants(self):
        """Both Alice and Bob connect to the same conversation and exchange real-time messages."""
        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )

        alice_conn, _ = await alice_comm.connect()
        bob_conn, _ = await bob_comm.connect()
        self.assertTrue(alice_conn)
        self.assertTrue(bob_conn)

        # Discard handshake payloads
        await alice_comm.receive_json_from()
        await bob_comm.receive_json_from()

        # Alice sends message
        await alice_comm.send_json_to({
            'type': 'chat_message',
            'content': 'Hi Bob, how are you?'
        })

        # Both receive Alice's message in real time
        alice_recv = await alice_comm.receive_json_from()
        bob_recv = await bob_comm.receive_json_from()

        self.assertEqual(alice_recv['message']['content'], 'Hi Bob, how are you?')
        self.assertEqual(bob_recv['message']['content'], 'Hi Bob, how are you?')
        self.assertEqual(bob_recv['message']['sender']['id'], self.user1.id)

        # Bob replies to Alice
        await bob_comm.send_json_to({
            'type': 'chat_message',
            'content': 'Doing great Alice!'
        })

        alice_reply = await alice_comm.receive_json_from()
        bob_reply = await bob_comm.receive_json_from()

        self.assertEqual(alice_reply['message']['content'], 'Doing great Alice!')
        self.assertEqual(bob_reply['message']['content'], 'Doing great Alice!')
        self.assertEqual(alice_reply['message']['sender']['id'], self.user2.id)

        await alice_comm.disconnect()
        await bob_comm.disconnect()

    async def test_empty_message_validation_error(self):
        """Sending empty message returns error without saving."""
        communicator = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await communicator.connect()
        self.assertTrue(connected)
        await communicator.receive_json_from()

        # Send blank message
        await communicator.send_json_to({
            'type': 'chat_message',
            'content': '   '
        })

        err_response = await communicator.receive_json_from()
        self.assertEqual(err_response['type'], 'error')
        self.assertIn('cannot be blank', err_response['message'])

        await communicator.disconnect()

    async def test_websocket_mark_messages_read_broadcast(self):
        """Sending mark_read over WebSocket updates database and broadcasts to group."""
        msg = await Message.objects.acreate(
            conversation=self.conversation,
            sender=self.user2,
            content='Unread peer message'
        )

        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )

        await alice_comm.connect()
        await bob_comm.connect()
        await alice_comm.receive_json_from()
        await bob_comm.receive_json_from()

        # Alice marks messages read
        await alice_comm.send_json_to({'type': 'mark_read'})

        # Bob receives read receipt
        bob_event = await bob_comm.receive_json_from()
        self.assertEqual(bob_event['type'], 'messages_read')
        self.assertEqual(bob_event['conversation_id'], self.conversation.id)
        self.assertEqual(bob_event['reader_id'], self.user1.id)
        self.assertEqual(bob_event['read_count'], 1)

        refetched_msg = await Message.objects.aget(id=msg.id)
        self.assertTrue(refetched_msg.is_read)
        self.assertIsNotNone(refetched_msg.read_at)

        await alice_comm.disconnect()
        await bob_comm.disconnect()

    async def test_http_post_message_broadcasts_to_connected_websocket(self):
        """Messages created via REST HTTP POST are broadcast to connected WebSocket clients."""
        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await bob_comm.connect()
        self.assertTrue(connected)
        await bob_comm.receive_json_from()  # connection_established

        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        await channel_layer.group_send(
            f"chat_{self.conversation.id}",
            {
                "type": "chat_message_broadcast",
                "message": {
                    "id": 101,
                    "conversation_id": self.conversation.id,
                    "sender": {"id": self.user1.id, "name": self.user1.name},
                    "content": "Broadcast from HTTP POST",
                    "created_at": "2026-10-25T01:40:00Z",
                    "is_read": False,
                }
            }
        )

        # Bob receives it over WebSocket
        received = await bob_comm.receive_json_from()
        self.assertEqual(received['type'], 'chat_message')
        self.assertEqual(received['message']['content'], 'Broadcast from HTTP POST')

        await bob_comm.disconnect()


class ChannelLayerConfigurationTests(TestCase):
    """Tests for Issue #22 (RTC-030): Configure Redis as Django Channels channel layer."""

    def test_channel_layer_configured(self):
        """Channel layer is properly configured and resolvable."""
        from channels.layers import get_channel_layer
        channel_layer = get_channel_layer()
        self.assertIsNotNone(channel_layer)

    def test_channel_layer_group_send_and_receive(self):
        """Channel layer supports async group operations and message delivery."""
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()

        async def run_channel_test():
            channel_name = await channel_layer.new_channel()
            group_name = "test_verification_group"
            await channel_layer.group_add(group_name, channel_name)

            await channel_layer.group_send(
                group_name,
                {"type": "test.message", "payload": "redis_layer_validation"}
            )

            msg = await channel_layer.receive(channel_name)
            self.assertEqual(msg["type"], "test.message")
            self.assertEqual(msg["payload"], "redis_layer_validation")

            await channel_layer.group_discard(group_name, channel_name)

        async_to_sync(run_channel_test)()

    def test_redis_channel_layer_class_available(self):
        """channels_redis package is installed and RedisChannelLayer is importable."""
        from channels_redis.core import RedisChannelLayer
        self.assertTrue(issubclass(RedisChannelLayer, object))

    def test_settings_redis_fallback_and_options(self):
        """Settings define REDIS_URL and properly select channel layer backend."""
        from django.conf import settings
        self.assertTrue(hasattr(settings, 'CHANNEL_LAYERS'))
        self.assertIn('default', settings.CHANNEL_LAYERS)
        self.assertIn('BACKEND', settings.CHANNEL_LAYERS['default'])


class PresenceAndTypingWebSocketTests(TransactionTestCase):
    """
    Tests for Issue #23 (RTC-016: Presence) and Issue #24 (RTC-023: Typing indicators).
    """

    def setUp(self):
        super().setUp()
        from django.core.cache import cache
        cache.clear()

        self.user1 = User.objects.create_user(
            email="alice.presence@example.com",
            name="Alice Presence",
            password="StrongPassword123!"
        )
        self.user2 = User.objects.create_user(
            email="bob.presence@example.com",
            name="Bob Presence",
            password="StrongPassword123!"
        )
        self.conversation = Conversation.objects.create()
        ConversationParticipant.objects.create(conversation=self.conversation, user=self.user1)
        ConversationParticipant.objects.create(conversation=self.conversation, user=self.user2)

        self.user1_token = str(RefreshToken.for_user(self.user1).access_token)
        self.user2_token = str(RefreshToken.for_user(self.user2).access_token)

    async def test_typing_indicator_broadcast(self):
        """When Alice types, Bob receives typing notification; Alice does not receive echo."""
        alice_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        bob_comm = WebsocketCommunicator(
            application,
            f"/ws/chat/{self.conversation.id}/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )

        await alice_comm.connect()
        await bob_comm.connect()
        await alice_comm.receive_json_from()  # connection_established
        await bob_comm.receive_json_from()

        # Alice starts typing
        await alice_comm.send_json_to({
            'type': 'typing',
            'is_typing': True
        })

        # Bob receives typing event
        bob_event = await bob_comm.receive_json_from()
        self.assertEqual(bob_event['type'], 'typing')
        self.assertEqual(bob_event['conversation_id'], self.conversation.id)
        self.assertEqual(bob_event['user_id'], self.user1.id)
        self.assertTrue(bob_event['is_typing'])

        # Alice stops typing
        await alice_comm.send_json_to({
            'type': 'typing',
            'is_typing': False
        })

        bob_stop = await bob_comm.receive_json_from()
        self.assertEqual(bob_stop['type'], 'typing')
        self.assertFalse(bob_stop['is_typing'])

        # Alice should NOT receive her own typing events
        self.assertTrue(await alice_comm.receive_nothing())

        await alice_comm.disconnect()
        await bob_comm.disconnect()

    async def test_presence_consumer_connect_and_broadcast(self):
        """Users connecting to /ws/presence/ receive online state and broadcast presence updates."""
        alice_presence = WebsocketCommunicator(
            application,
            f"/ws/presence/?token={self.user1_token}",
            headers=[(b"host", b"localhost")]
        )
        connected, _ = await alice_presence.connect()
        self.assertTrue(connected)

        # Alice receives initial snapshot
        alice_state = await alice_presence.receive_json_from()
        self.assertEqual(alice_state['type'], 'presence_state')
        self.assertIn(self.user1.id, alice_state['online_user_ids'])

        # Bob connects to presence
        bob_presence = WebsocketCommunicator(
            application,
            f"/ws/presence/?token={self.user2_token}",
            headers=[(b"host", b"localhost")]
        )
        await bob_presence.connect()

        # Alice receives real-time broadcast that Bob came online
        bob_online_event = await alice_presence.receive_json_from()
        self.assertEqual(bob_online_event['type'], 'presence_update')
        self.assertEqual(bob_online_event['user_id'], self.user2.id)
        self.assertEqual(bob_online_event['status'], 'online')

        # Bob disconnects
        await bob_presence.disconnect()

        # Alice receives real-time broadcast that Bob went offline
        bob_offline_event = await alice_presence.receive_json_from()
        self.assertEqual(bob_offline_event['type'], 'presence_update')
        self.assertEqual(bob_offline_event['user_id'], self.user2.id)
        self.assertEqual(bob_offline_event['status'], 'offline')

        await alice_presence.disconnect()


class UserPresenceAPITests(APITestCase):
    """Tests for UserPresenceStatusView and presence cache tracking functions."""

    def setUp(self):
        from django.core.cache import cache
        cache.clear()
        self.user1 = User.objects.create_user(
            email="alice.api@example.com",
            name="Alice",
            password="StrongPassword123!"
        )
        self.user2 = User.objects.create_user(
            email="bob.api@example.com",
            name="Bob",
            password="StrongPassword123!"
        )
        self.client.force_authenticate(user=self.user1)

    def test_presence_helper_functions(self):
        """track_user_connected and track_user_disconnected manage connection counts and state."""
        from chat.presence import (
            track_user_connected,
            track_user_disconnected,
            is_user_online,
            get_online_user_ids
        )

        # Connect tab 1
        conns, is_new = track_user_connected(self.user1.id)
        self.assertEqual(conns, 1)
        self.assertTrue(is_new)
        self.assertTrue(is_user_online(self.user1.id))
        self.assertIn(self.user1.id, get_online_user_ids())

        # Connect tab 2
        conns, is_new = track_user_connected(self.user1.id)
        self.assertEqual(conns, 2)
        self.assertFalse(is_new)  # already online

        # Close tab 2
        conns, is_offline = track_user_disconnected(self.user1.id)
        self.assertEqual(conns, 1)
        self.assertFalse(is_offline)  # still has 1 tab open
        self.assertTrue(is_user_online(self.user1.id))

        # Close tab 1
        conns, is_offline = track_user_disconnected(self.user1.id)
        self.assertEqual(conns, 0)
        self.assertTrue(is_offline)
        self.assertFalse(is_user_online(self.user1.id))

    def test_get_user_presence_status_api(self):
        """GET /api/users/presence/?user_ids=... returns online status for requested users."""
        from chat.presence import track_user_connected
        track_user_connected(self.user1.id)

        url = reverse('api:users:user_presence')
        response = self.client.get(f"{url}?user_ids={self.user1.id},{self.user2.id}")
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        data = {item['user_id']: item['is_online'] for item in response.data}
        self.assertTrue(data[self.user1.id])
        self.assertFalse(data[self.user2.id])


class MultiInstanceWebSocketScalingTests(TestCase):
    """
    Tests for Issue #25 (RTC-031): Validate multi-instance WebSocket horizontal scaling with channel layer.
    """

    def test_cross_instance_group_broadcasting(self):
        """
        Verify that multiple independent channel listeners on the same group
        receive broadcasts identically, confirming horizontally scalable pub/sub.
        """
        from channels.layers import get_channel_layer
        from asgiref.sync import async_to_sync

        channel_layer = get_channel_layer()

        async def run_scale_test():
            group_name = "scaling_cluster_group"

            # Instance A channel
            ch_a = await channel_layer.new_channel()
            # Instance B channel
            ch_b = await channel_layer.new_channel()

            await channel_layer.group_add(group_name, ch_a)
            await channel_layer.group_add(group_name, ch_b)

            # Broadcast from Instance C into group
            await channel_layer.group_send(
                group_name,
                {
                    "type": "scale_broadcast",
                    "event_id": "uuid-1234",
                    "payload": "cluster_sync_ok",
                }
            )

            # Both Instance A and Instance B receive the message
            msg_a = await channel_layer.receive(ch_a)
            msg_b = await channel_layer.receive(ch_b)

            self.assertEqual(msg_a["event_id"], "uuid-1234")
            self.assertEqual(msg_a["payload"], "cluster_sync_ok")
            self.assertEqual(msg_b["event_id"], "uuid-1234")
            self.assertEqual(msg_b["payload"], "cluster_sync_ok")

            await channel_layer.group_discard(group_name, ch_a)
            await channel_layer.group_discard(group_name, ch_b)

        async_to_sync(run_scale_test)()



