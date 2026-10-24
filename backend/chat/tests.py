from django.contrib.auth import get_user_model
from django.db import IntegrityError
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
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
