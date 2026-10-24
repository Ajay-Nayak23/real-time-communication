from django.conf import settings
from django.db import models


class Conversation(models.Model):
    """
    Represents a conversation between two or more participants.
    """

    id = models.BigAutoField(primary_key=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chat_conversations'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['created_at'], name='chat_conv_created_idx'),
            models.Index(fields=['updated_at'], name='chat_conv_updated_idx'),
        ]

    def __str__(self):
        return f"Conversation {self.id}"


class ConversationParticipant(models.Model):
    """
    Represents a participant belonging to a conversation.
    Enforces a unique constraint to prevent duplicate participants in the same conversation.
    """

    id = models.BigAutoField(primary_key=True)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='participants',
        db_index=True,
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='conversation_participations',
        db_index=True,
    )
    joined_at = models.DateTimeField(auto_now_add=True)
    last_read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'chat_conversation_participants'
        ordering = ['joined_at']
        constraints = [
            models.UniqueConstraint(
                fields=['conversation', 'user'],
                name='unique_conversation_participant',
            ),
        ]
        indexes = [
            models.Index(fields=['conversation', 'user'], name='chat_part_conv_user_idx'),
            models.Index(fields=['joined_at'], name='chat_part_joined_idx'),
        ]

    def __str__(self):
        return f"User {self.user_id} in Conversation {self.conversation_id}"


class Message(models.Model):
    """
    Represents a single message sent within a conversation.
    Includes soft-delete readiness and optimized indexing for fast history retrieval.
    """

    id = models.BigAutoField(primary_key=True)
    conversation = models.ForeignKey(
        Conversation,
        on_delete=models.CASCADE,
        related_name='messages',
        db_index=True,
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='sent_messages',
        db_index=True,
    )
    content = models.TextField()
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    is_deleted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'chat_messages'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['conversation', 'created_at'], name='chat_msg_conv_created_idx'),
            models.Index(fields=['created_at'], name='chat_msg_created_idx'),
        ]

    def __str__(self):
        return f"Message {self.id} from User {self.sender_id} in Conversation {self.conversation_id}"
