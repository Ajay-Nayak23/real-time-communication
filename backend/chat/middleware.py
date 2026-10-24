from urllib.parse import parse_qs
from channels.db import database_sync_to_async
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken

User = get_user_model()


@database_sync_to_async
def get_user_from_token(token_string):
    """
    Decodes the JWT access token and loads the active user from database.
    Returns AnonymousUser if token is missing, invalid, or expired.
    """
    if not token_string:
        return AnonymousUser()

    try:
        access_token = AccessToken(token_string)
        user_id = access_token.get('user_id')
        if not user_id:
            return AnonymousUser()
        return User.objects.get(id=user_id, is_active=True)
    except Exception:
        return AnonymousUser()


class JWTAuthMiddleware:
    """
    ASGI middleware that authenticates WebSocket connections via JWT access token.
    Extracts token from:
    1. Query parameter: `?token=<JWT_ACCESS_TOKEN>`
    2. Header / Subprotocol: `Sec-WebSocket-Protocol`
    Populates `scope['user']` with authenticated User or AnonymousUser.
    """

    def __init__(self, inner):
        self.inner = inner

    async def __call__(self, scope, receive, send):
        if scope.get('type') == 'websocket':
            token = None

            # 1. Check query parameters
            query_string = scope.get('query_string', b'').decode('utf-8')
            if query_string:
                query_params = parse_qs(query_string)
                token_list = query_params.get('token')
                if token_list:
                    token = token_list[0]

            # 2. Check headers / subprotocol if query param is not provided
            if not token:
                headers = dict(scope.get('headers', []))
                # Check sec-websocket-protocol
                proto_header = headers.get(b'sec-websocket-protocol', b'').decode('utf-8')
                if proto_header:
                    # Could be "token, <token>" or comma-separated tokens
                    protocols = [p.strip() for p in proto_header.split(',')]
                    for p in protocols:
                        if p.startswith('bearer-'):
                            token = p.replace('bearer-', '')
                            break
                        elif p != 'chat' and p != 'token':
                            token = p
                            break

                # Also check authorization header if forwarded
                if not token:
                    auth_header = headers.get(b'authorization', b'').decode('utf-8')
                    if auth_header.startswith('Bearer '):
                        token = auth_header.split('Bearer ', 1)[1].strip()

            scope['user'] = await get_user_from_token(token)

        return await self.inner(scope, receive, send)


def JWTAuthMiddlewareStack(inner):
    """
    Convenience helper function wrapping inner application with JWTAuthMiddleware.
    """
    return JWTAuthMiddleware(inner)
