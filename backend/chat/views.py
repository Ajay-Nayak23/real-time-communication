from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import CursorPagination, PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from chat.models import Conversation, Message
from chat.serializers import (
    ConversationSerializer,
    CreateConversationSerializer,
    CreateMessageSerializer,
    MessageSerializer,
)


class MessageCursorPagination(CursorPagination):
    """
    Cursor-based pagination for chat timelines.
    Prevents item shifting when new messages are posted.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
    ordering = '-created_at'


class MessagePageNumberPagination(PageNumberPagination):
    """
    Standard page-number pagination for message history.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ConversationListCreateView(APIView):
    """
    List user conversations or initiate a one-to-one conversation.
    GET  /api/chat/conversations/
    POST /api/chat/conversations/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        """
        Retrieve all conversations in which the requesting user participates.
        """
        conversations = (
            Conversation.objects.filter(participants__user=request.user)
            .distinct()
            .prefetch_related('participants__user', 'messages__sender')
            .order_by('-updated_at')
        )
        serializer = ConversationSerializer(conversations, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, *args, **kwargs):
        """
        Initiate or retrieve an existing one-to-one conversation with a recipient user.
        Prevents duplicate conversations between the same two users.
        """
        serializer = CreateConversationSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            conversation = serializer.save()
            was_created = serializer.context.get('created', True)
            response_status = status.HTTP_201_CREATED if was_created else status.HTTP_200_OK

            response_serializer = ConversationSerializer(conversation, context={'request': request})
            return Response(response_serializer.data, status=response_status)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ConversationDetailView(APIView):
    """
    Retrieve conversation details for a specific conversation ID.
    Enforces object-level permission ensuring only participants can view the conversation.
    GET /api/chat/conversations/<id>/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, pk, *args, **kwargs):
        conversation = get_object_or_404(
            Conversation.objects.prefetch_related('participants__user', 'messages__sender'),
            pk=pk
        )

        is_participant = conversation.participants.filter(user=request.user).exists()
        if not is_participant:
            return Response(
                {"detail": "You do not have permission to access this conversation."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = ConversationSerializer(conversation, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)


class ConversationMessagesView(APIView):
    """
    Retrieve paginated message history or send a new message in a conversation.
    GET  /api/chat/conversations/<id>/messages/
    POST /api/chat/conversations/<id>/messages/
    """

    permission_classes = [IsAuthenticated]

    def get_conversation(self, conversation_id, user):
        conversation = get_object_or_404(Conversation, pk=conversation_id)
        if not conversation.participants.filter(user=user).exists():
            return conversation, False
        return conversation, True

    def get(self, request, conversation_id, *args, **kwargs):
        """
        Retrieve paginated messages for a conversation.
        Enforces authorization: requesting user must be a participant.
        Supports:
        - Cursor-based pagination (default, ideal for infinite scroll)
        - Page-number pagination (?page=1)
        - Page size (?page_size=20)
        - Ordering (?ordering=-created_at or ?ordering=created_at)
        """
        conversation, is_participant = self.get_conversation(conversation_id, request.user)
        if not is_participant:
            return Response(
                {"detail": "You do not have permission to access messages in this conversation."},
                status=status.HTTP_403_FORBIDDEN
            )

        ordering = request.query_params.get('ordering', '-created_at')
        if ordering not in ['created_at', '-created_at']:
            ordering = '-created_at'

        messages = (
            Message.objects.filter(conversation=conversation, is_deleted=False)
            .select_related('sender')
            .order_by(ordering)
        )

        if 'page' in request.query_params:
            paginator = MessagePageNumberPagination()
        else:
            paginator = MessageCursorPagination()
            paginator.ordering = ordering

        page = paginator.paginate_queryset(messages, request, view=self)
        if page is not None:
            serializer = MessageSerializer(page, many=True, context={'request': request})
            return paginator.get_paginated_response(serializer.data)

        serializer = MessageSerializer(messages, many=True, context={'request': request})
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request, conversation_id, *args, **kwargs):
        """
        Send a message within the specified conversation.
        Enforces authorization: requesting user must be a participant.
        """
        conversation, is_participant = self.get_conversation(conversation_id, request.user)
        if not is_participant:
            return Response(
                {"detail": "You do not have permission to send messages in this conversation."},
                status=status.HTTP_403_FORBIDDEN
            )

        serializer = CreateMessageSerializer(data=request.data)
        if serializer.is_valid():
            with transaction.atomic():
                message = Message.objects.create(
                    conversation=conversation,
                    sender=request.user,
                    content=serializer.validated_data['content']
                )
                conversation.save(update_fields=['updated_at'])

            response_serializer = MessageSerializer(message, context={'request': request})

            # Broadcast new message to Channels conversation group so connected peers receive real-time message
            try:
                channel_layer = get_channel_layer()
                if channel_layer:
                    async_to_sync(channel_layer.group_send)(
                        f"chat_{conversation.id}",
                        {
                            "type": "chat_message_broadcast",
                            "message": response_serializer.data,
                        }
                    )
            except Exception:
                pass

            return Response(response_serializer.data, status=status.HTTP_201_CREATED)

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class ConversationMarkReadView(APIView):
    """
    Mark all unread messages in a conversation as read by the requesting user.
    Enforces authorization: requesting user must be a participant.
    POST /api/chat/conversations/<conversation_id>/read/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, conversation_id, *args, **kwargs):
        conversation = get_object_or_404(Conversation, pk=conversation_id)

        participant = conversation.participants.filter(user=request.user).first()
        if not participant:
            return Response(
                {"detail": "You do not have permission to access this conversation."},
                status=status.HTTP_403_FORBIDDEN
            )

        now = timezone.now()
        with transaction.atomic():
            unread_qs = conversation.messages.filter(
                is_read=False,
                is_deleted=False
            ).exclude(sender=request.user)

            read_count = unread_qs.update(is_read=True, read_at=now)

            participant.last_read_at = now
            participant.save(update_fields=['last_read_at'])

        # Broadcast read receipt to WebSocket conversation group
        try:
            channel_layer = get_channel_layer()
            if channel_layer:
                async_to_sync(channel_layer.group_send)(
                    f"chat_{conversation.id}",
                    {
                        "type": "chat_messages_read",
                        "conversation_id": conversation.id,
                        "reader_id": request.user.id,
                        "read_at": now.isoformat(),
                        "read_count": read_count,
                    }
                )
        except Exception:
            pass

        return Response({
            "status": "success",
            "conversation_id": conversation.id,
            "read_count": read_count,
            "unread_count": 0,
        }, status=status.HTTP_200_OK)

