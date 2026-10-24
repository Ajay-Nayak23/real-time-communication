from django.contrib.auth import get_user_model
from rest_framework import serializers
from calls.models import Call

User = get_user_model()


class CallUserSerializer(serializers.ModelSerializer):
    """Minimal user representation for call participants."""

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'profile_image']
        read_only_fields = fields


class CallSerializer(serializers.ModelSerializer):
    """Full serializer for Call model representation."""

    caller = CallUserSerializer(read_only=True)
    callee = CallUserSerializer(read_only=True)
    other_participant = serializers.SerializerMethodField()

    class Meta:
        model = Call
        fields = [
            'id',
            'uuid',
            'caller',
            'callee',
            'other_participant',
            'call_type',
            'status',
            'duration',
            'started_at',
            'ended_at',
            'created_at',
            'updated_at',
        ]
        read_only_fields = fields

    def get_other_participant(self, obj):
        request = self.context.get('request')
        if not request or not request.user.is_authenticated:
            return None
        current_user = request.user
        partner = obj.callee if obj.caller_id == current_user.id else obj.caller
        return CallUserSerializer(partner).data


class CallInitiateSerializer(serializers.Serializer):
    """Validation serializer for initiating a new call."""

    callee_id = serializers.IntegerField(required=True)
    call_type = serializers.ChoiceField(
        choices=Call.CallType.choices,
        default=Call.CallType.AUDIO
    )

    def validate_callee_id(self, value):
        request = self.context.get('request')
        if request and request.user.id == value:
            raise serializers.ValidationError("You cannot initiate a call to yourself.")
        if not User.objects.filter(id=value, is_active=True).exists():
            raise serializers.ValidationError("Target user does not exist or is inactive.")
        return value
