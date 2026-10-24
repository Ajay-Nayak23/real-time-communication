import json
from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncWebsocketConsumer
from django.db import transaction
from django.utils import timezone
from chat.models import Conversation, ConversationParticipant, Message
from chat.serializers import MessageSerializer


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time bidirectional chat messaging.
    Listens on `/ws/chat/<conversation_id>/`.
    Enforces JWT authentication and conversation participant authorization.
    """

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs'].get('conversation_id')
        self.user = self.scope.get('user')

        # 1. Enforce authentication
        if not self.user or not self.user.is_authenticated:
            await self.close(code=4401)
            return

        # 2. Enforce conversation participant authorization
        is_participant = await self.check_participant(self.conversation_id, self.user.id)
        if not is_participant:
            await self.close(code=4403)
            return

        self.room_group_name = f"chat_{self.conversation_id}"

        # 3. Join conversation group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()

        # Send connection confirmation to client
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'conversation_id': int(self.conversation_id),
            'user_id': self.user.id,
        }))

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group_name'):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

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

        msg_type = payload.get('type') or payload.get('action') or 'chat_message'
        content = payload.get('content') or payload.get('message')

        if msg_type in ['chat_message', 'message', 'send_message']:
            if not content or not str(content).strip():
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'message': 'Message content cannot be blank.',
                }))
                return

            # Persist message to database
            saved_message = await self.persist_message(
                self.conversation_id,
                self.user.id,
                str(content).strip()
            )

            # Broadcast message to all participants connected to this conversation
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message_broadcast',
                    'message': saved_message,
                }
            )

        elif msg_type in ['read_messages', 'mark_read', 'read']:
            now = timezone.now()
            read_count = await self.mark_messages_read(self.conversation_id, self.user.id, now)
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_messages_read',
                    'conversation_id': int(self.conversation_id),
                    'reader_id': self.user.id,
                    'read_at': now.isoformat(),
                    'read_count': read_count,
                }
            )

    async def chat_message_broadcast(self, event):
        """
        Handler called when group receives `chat_message_broadcast`.
        Forwards message payload to the WebSocket client.
        """
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
        }))

    async def chat_messages_read(self, event):
        """
        Handler called when messages are marked as read in the conversation group.
        Broadcasts read receipt event to connected WebSocket clients.
        """
        await self.send(text_data=json.dumps({
            'type': 'messages_read',
            'conversation_id': event['conversation_id'],
            'reader_id': event['reader_id'],
            'read_at': event['read_at'],
            'read_count': event['read_count'],
        }))

    @database_sync_to_async
    def check_participant(self, conversation_id, user_id):
        """
        Verify that the conversation exists and user is an authorized participant.
        """
        try:
            conv_id = int(conversation_id)
        except (ValueError, TypeError):
            return False

        return ConversationParticipant.objects.filter(
            conversation_id=conv_id,
            user_id=user_id
        ).exists()

    @database_sync_to_async
    def persist_message(self, conversation_id, user_id, content):
        """
        Persist message to database and touch conversation updated_at atomically.
        """
        with transaction.atomic():
            msg = Message.objects.create(
                conversation_id=int(conversation_id),
                sender_id=user_id,
                content=content
            )
            Conversation.objects.filter(id=int(conversation_id)).update(updated_at=timezone.now())

        return MessageSerializer(msg).data

    @database_sync_to_async
    def mark_messages_read(self, conversation_id, user_id, read_time):
        """
        Mark all unread messages in the conversation sent by other users as read.
        Updates participant last_read_at timestamp.
        """
        try:
            conv_id = int(conversation_id)
        except (ValueError, TypeError):
            return 0

        with transaction.atomic():
            unread = Message.objects.filter(
                conversation_id=conv_id,
                is_read=False,
                is_deleted=False
            ).exclude(sender_id=user_id)
            count = unread.update(is_read=True, read_at=read_time)

            ConversationParticipant.objects.filter(
                conversation_id=conv_id,
                user_id=user_id
            ).update(last_read_at=read_time)

        return count

