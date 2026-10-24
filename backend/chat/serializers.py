from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count
from rest_framework import serializers
from chat.models import Conversation, ConversationParticipant, Message

User = get_user_model()


class ParticipantUserSerializer(serializers.ModelSerializer):
    """
    Public representation of a user participating in a conversation.
    """

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'profile_image', 'last_seen']
        read_only_fields = fields


class ConversationParticipantSerializer(serializers.ModelSerializer):
    """
    Represents a participant membership within a conversation.
    """

    user = ParticipantUserSerializer(read_only=True)

    class Meta:
        model = ConversationParticipant
        fields = ['id', 'user', 'joined_at']
        read_only_fields = fields


class LastMessageSerializer(serializers.ModelSerializer):
    """
    Summary representation of the most recent message in a conversation.
    """

    sender_id = serializers.IntegerField(source='sender.id', read_only=True)
    sender_name = serializers.CharField(source='sender.name', read_only=True)

    class Meta:
        model = Message
        fields = ['id', 'sender_id', 'sender_name', 'content', 'is_read', 'created_at']
        read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
    """
    Detailed and list representation of a conversation.
    Includes participant list, the other participant helper, the last message preview,
    and unread message count for the requesting user.
    """

    participants = ConversationParticipantSerializer(many=True, read_only=True)
    other_participant = serializers.SerializerMethodField()
    last_message = serializers.SerializerMethodField()
    unread_count = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id',
            'created_at',
            'updated_at',
            'participants',
            'other_participant',
            'last_message',
            'unread_count',
        ]
        read_only_fields = fields

    def get_other_participant(self, obj):
        """
        Returns the other user's profile for one-to-one conversations.
        """
        request = self.context.get('request')
        current_user = request.user if request and request.user.is_authenticated else None

        for participant in obj.participants.all():
            if current_user is None or participant.user_id != current_user.id:
                return ParticipantUserSerializer(participant.user).data
        return None

    def get_last_message(self, obj):
        """
        Returns the latest message in the conversation, ignoring soft-deleted messages.
        """
        latest_msg = (
            obj.messages.filter(is_deleted=False)
            .select_related('sender')
            .order_by('-created_at')
            .first()
        )
        if latest_msg:
            return LastMessageSerializer(latest_msg).data
        return None

    def get_unread_count(self, obj):
        """
        Returns unread message count for the current authenticated user.
        """
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return 0

        return obj.messages.filter(
            is_read=False,
            is_deleted=False
        ).exclude(sender=request.user).count()


class CreateConversationSerializer(serializers.Serializer):
    """
    Serializer for initiating or fetching a one-to-one conversation with a recipient user.
    Enforces prevention of duplicate conversations between the same two users.
    """

    recipient_id = serializers.IntegerField(required=False)
    recipient_email = serializers.EmailField(required=False)

    def validate(self, attrs):
        recipient_id = attrs.get('recipient_id')
        recipient_email = attrs.get('recipient_email')
        request = self.context.get('request')
        current_user = request.user if request else None

        if not recipient_id and not recipient_email:
            raise serializers.ValidationError(
                "Either 'recipient_id' or 'recipient_email' must be provided."
            )

        try:
            if recipient_id:
                recipient = User.objects.get(id=recipient_id)
            else:
                recipient = User.objects.get(email__iexact=recipient_email.strip())
        except User.DoesNotExist:
            raise serializers.ValidationError(
                {"recipient": "The specified recipient user does not exist."}
            )

        if not recipient.is_active:
            raise serializers.ValidationError(
                {"recipient": "The specified recipient user is inactive."}
            )

        if current_user and current_user.id == recipient.id:
            raise serializers.ValidationError(
                {"recipient": "Cannot start a conversation with yourself."}
            )

        attrs['recipient'] = recipient
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        current_user = request.user
        recipient = validated_data['recipient']

        # Check if an existing 1-on-1 conversation already exists between these two users
        user_conversations = ConversationParticipant.objects.filter(
            user=current_user
        ).values_list('conversation_id', flat=True)

        shared_conversations = ConversationParticipant.objects.filter(
            conversation_id__in=user_conversations,
            user=recipient
        ).values_list('conversation_id', flat=True)

        existing_conversation = (
            Conversation.objects.filter(id__in=shared_conversations)
            .annotate(participant_count=Count('participants'))
            .filter(participant_count=2)
            .first()
        )

        if existing_conversation:
            self.context['created'] = False
            return existing_conversation

        # Create new 1-on-1 conversation atomically
        with transaction.atomic():
            conversation = Conversation.objects.create()
            ConversationParticipant.objects.bulk_create([
                ConversationParticipant(conversation=conversation, user=current_user),
                ConversationParticipant(conversation=conversation, user=recipient),
            ])

        self.context['created'] = True
        return conversation


class MessageSerializer(serializers.ModelSerializer):
    """
    Detailed serializer for chat messages.
    Includes sender profile information and conversation ID.
    """

    sender = ParticipantUserSerializer(read_only=True)
    conversation_id = serializers.IntegerField(source='conversation.id', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id',
            'conversation_id',
            'sender',
            'content',
            'is_read',
            'is_deleted',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields


class CreateMessageSerializer(serializers.ModelSerializer):
    """
    Serializer for sending a message to a conversation.
    """

    content = serializers.CharField(
        required=True,
        allow_blank=False,
        max_length=5000,
        error_messages={'blank': 'Message content cannot be blank.'}
    )

    class Meta:
        model = Message
        fields = ['content']

    def validate_content(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Message content cannot be empty.')
        return cleaned
