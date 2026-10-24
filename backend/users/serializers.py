from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer

User = get_user_model()


class UserSerializer(serializers.ModelSerializer):
    """
    Serializer for public user profiles and safe response representations.
    Never exposes passwords or sensitive auth tokens.
    """

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'bio', 'profile_image', 'last_seen', 'created_at']
        read_only_fields = ['id', 'email', 'last_seen', 'created_at']


class UserProfileSerializer(serializers.ModelSerializer):
    """
    Serializer for retrieving and updating user profile information.
    Ensures sensitive fields (id, email, is_staff, is_active, created_at, updated_at, last_seen)
    are strictly read-only and cannot be tampered with.
    """

    avatar = serializers.URLField(source='profile_image', required=False, allow_null=True)

    class Meta:
        model = User
        fields = [
            'id',
            'email',
            'name',
            'bio',
            'profile_image',
            'avatar',
            'last_seen',
            'is_active',
            'is_staff',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'email',
            'last_seen',
            'is_active',
            'is_staff',
            'created_at',
            'updated_at',
        ]

    def validate_name(self, value):
        cleaned = value.strip()
        if not cleaned:
            raise serializers.ValidationError('Name cannot be blank.')
        return cleaned


class UserDirectorySerializer(serializers.ModelSerializer):
    """
    Serializer for public user discovery directory.
    Exposes only safe public fields.
    """

    class Meta:
        model = User
        fields = ['id', 'email', 'name', 'bio', 'profile_image', 'last_seen']
        read_only_fields = fields


class RegisterSerializer(serializers.Serializer):
    """
    Serializer validating and creating new users during registration.
    """

    email = serializers.EmailField(required=True)
    name = serializers.CharField(required=True, max_length=150, min_length=1)
    password = serializers.CharField(
        write_only=True,
        required=True,
        style={'input_type': 'password'}
    )

    def validate_email(self, value):
        normalized_email = value.lower().strip()
        if User.objects.filter(email__iexact=normalized_email).exists():
            raise serializers.ValidationError('A user with this email already exists.')
        return normalized_email

    def validate_password(self, value):
        if len(value) < 8:
            raise serializers.ValidationError('Password must be at least 8 characters long.')
        validate_password(value)
        return value

    def validate_name(self, value):
        cleaned_name = value.strip()
        if not cleaned_name:
            raise serializers.ValidationError('Name cannot be blank.')
        return cleaned_name

    def create(self, validated_data):
        return User.objects.create_user(
            email=validated_data['email'],
            name=validated_data['name'],
            password=validated_data['password']
        )


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Custom JWT login serializer that includes user metadata in the response.
    """

    username_field = 'email'

    def validate(self, attrs):
        data = super().validate(attrs)
        data['user'] = UserSerializer(self.user).data
        return data


class LogoutSerializer(serializers.Serializer):
    """
    Serializer for logging out and blacklisting a refresh token.
    """

    refresh = serializers.CharField(required=True)
