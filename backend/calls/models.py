import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone


class Call(models.Model):
    """
    Data model representing a WebRTC 1-to-1 audio or video call session.
    Tracks participants, media mode, session state transitions, and duration.
    """

    class CallType(models.TextChoices):
        AUDIO = 'audio', 'Audio'
        VIDEO = 'video', 'Video'

    class Status(models.TextChoices):
        RINGING = 'ringing', 'Ringing'
        ONGOING = 'ongoing', 'Ongoing'
        REJECTED = 'rejected', 'Rejected'
        MISSED = 'missed', 'Missed'
        ENDED = 'ended', 'Ended'
        BUSY = 'busy', 'Busy'
        FAILED = 'failed', 'Failed'

    id = models.BigAutoField(primary_key=True)
    uuid = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)

    caller = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='initiated_calls'
    )
    callee = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='received_calls'
    )

    call_type = models.CharField(
        max_length=10,
        choices=CallType.choices,
        default=CallType.AUDIO,
        db_index=True
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.RINGING,
        db_index=True
    )

    started_at = models.DateTimeField(null=True, blank=True)
    ended_at = models.DateTimeField(null=True, blank=True)
    duration = models.PositiveIntegerField(
        default=0,
        help_text="Call duration in seconds"
    )

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['caller', 'status']),
            models.Index(fields=['callee', 'status']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"Call #{self.id} ({self.call_type}) {self.caller_id} -> {self.callee_id} [{self.status}]"

    def mark_accepted(self):
        """Mark call as accepted and ongoing."""
        now = timezone.now()
        self.status = self.Status.ONGOING
        if not self.started_at:
            self.started_at = now
        self.save(update_fields=['status', 'started_at', 'updated_at'])

    def mark_rejected(self):
        """Mark call as rejected by recipient."""
        self.status = self.Status.REJECTED
        self.ended_at = timezone.now()
        self.save(update_fields=['status', 'ended_at', 'updated_at'])

    def mark_missed(self):
        """Mark call as missed (timed out)."""
        self.status = self.Status.MISSED
        self.ended_at = timezone.now()
        self.save(update_fields=['status', 'ended_at', 'updated_at'])

    def mark_ended(self):
        """End call and compute duration in seconds."""
        now = timezone.now()
        self.status = self.Status.ENDED
        self.ended_at = now
        if self.started_at:
            delta = (now - self.started_at).total_seconds()
            self.duration = max(0, int(delta))
        self.save(update_fields=['status', 'ended_at', 'duration', 'updated_at'])
