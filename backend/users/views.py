from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework import status
from rest_framework.generics import ListAPIView, RetrieveUpdateAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView
from users.serializers import (
    CustomTokenObtainPairSerializer,
    LogoutSerializer,
    RegisterSerializer,
    UserDirectorySerializer,
    UserProfileSerializer,
    UserSerializer,
)

User = get_user_model()


class RegisterView(APIView):
    """
    Endpoint for new user registration.
    POST /api/auth/register/
    """

    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            response_serializer = UserSerializer(user)
            return Response(response_serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class LoginView(TokenObtainPairView):
    """
    Endpoint for authenticating users via JWT.
    POST /api/auth/login/
    Returns access, refresh tokens and user profile.
    """

    permission_classes = [AllowAny]
    serializer_class = CustomTokenObtainPairSerializer


class LogoutView(APIView):
    """
    Endpoint for revoking refresh token (blacklisting).
    POST /api/auth/logout/
    """

    permission_classes = [IsAuthenticated]

    def post(self, request, *args, **kwargs):
        serializer = LogoutSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        try:
            refresh_token = serializer.validated_data['refresh']
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except TokenError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)


class ProtectedTestView(APIView):
    """
    Protected endpoint to verify JWT Bearer token authentication.
    GET /api/auth/test-protected/
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        return Response({
            'message': 'Authenticated successfully',
            'user': UserSerializer(request.user).data
        }, status=status.HTTP_200_OK)


class UserProfileMeView(RetrieveUpdateAPIView):
    """
    Endpoint for viewing and updating the authenticated user's profile.
    GET /api/users/me/
    PATCH /api/users/me/
    PUT /api/users/me/
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserProfileSerializer

    def get_object(self):
        """
        Always return the authenticated user from the request,
        guaranteeing that users can only view and modify their own profile.
        """
        return self.request.user


class UserDirectoryPagination(PageNumberPagination):
    """
    Standard pagination for the user discovery directory.
    Defaults to 20 users per page, configurable via ?page_size=.
    """

    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class UserDirectoryListView(ListAPIView):
    """
    Endpoint allowing authenticated users to discover other registered users.
    GET /api/users/
    Query parameters:
    - search: filter by name or email (case-insensitive substring match)
    - page: page number
    - page_size: custom results per page (up to 100)
    Excludes the requesting user from the response list.
    """

    permission_classes = [IsAuthenticated]
    serializer_class = UserDirectorySerializer
    pagination_class = UserDirectoryPagination

    def get_queryset(self):
        user = self.request.user
        queryset = (
            User.objects.filter(is_active=True)
            .exclude(id=user.id)
            .order_by('name', 'email')
        )

        search_query = self.request.query_params.get('search', '').strip()
        if search_query:
            queryset = queryset.filter(
                Q(name__icontains=search_query) | Q(email__icontains=search_query)
            )

        return queryset


class UserPresenceStatusView(APIView):
    """
    Endpoint for querying presence status of specific users or all online users.
    GET /api/users/presence/?user_ids=1,2,3
    """

    permission_classes = [IsAuthenticated]

    def get(self, request, *args, **kwargs):
        from chat.presence import get_online_user_ids, is_user_online

        user_ids_param = request.query_params.get('user_ids', '')
        if user_ids_param:
            try:
                ids = [int(i.strip()) for i in user_ids_param.split(',') if i.strip()]
            except ValueError:
                return Response(
                    {'detail': 'Invalid user_ids parameter.'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            users = User.objects.filter(id__in=ids, is_active=True)
        else:
            online_ids = get_online_user_ids()
            users = User.objects.filter(id__in=online_ids, is_active=True)

        results = []
        for u in users:
            results.append({
                'user_id': u.id,
                'is_online': is_user_online(u.id),
                'last_seen': u.last_seen.isoformat() if u.last_seen else None,
            })

        return Response(results, status=status.HTTP_200_OK)


