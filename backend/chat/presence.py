from django.core.cache import cache
from django.utils import timezone
from users.models import User

ONLINE_USERS_KEY = "presence:online_user_ids"
USER_CONN_COUNT_KEY = "presence:user:{}:connections"


def track_user_connected(user_id: int) -> tuple[int, bool]:
    """
    Register a WebSocket connection for the given user.
    Returns (connection_count, is_newly_online).
    """
    uid = int(user_id)
    conn_key = USER_CONN_COUNT_KEY.format(uid)
    current_conns = cache.get(conn_key, 0)
    new_conns = current_conns + 1
    cache.set(conn_key, new_conns, timeout=None)

    online_set = set(cache.get(ONLINE_USERS_KEY, []))
    is_newly_online = uid not in online_set
    if is_newly_online:
        online_set.add(uid)
        cache.set(ONLINE_USERS_KEY, list(online_set), timeout=None)

    return new_conns, is_newly_online


def track_user_disconnected(user_id: int) -> tuple[int, bool]:
    """
    Handle a WebSocket disconnection for the given user.
    Returns (connection_count, is_newly_offline).
    """
    uid = int(user_id)
    conn_key = USER_CONN_COUNT_KEY.format(uid)
    current_conns = cache.get(conn_key, 0)
    new_conns = max(0, current_conns - 1)

    if new_conns == 0:
        cache.delete(conn_key)
        online_set = set(cache.get(ONLINE_USERS_KEY, []))
        is_newly_offline = uid in online_set
        if is_newly_offline:
            online_set.discard(uid)
            cache.set(ONLINE_USERS_KEY, list(online_set), timeout=None)
            User.objects.filter(id=uid).update(last_seen=timezone.now())
        return 0, is_newly_offline

    cache.set(conn_key, new_conns, timeout=None)
    return new_conns, False


def is_user_online(user_id: int) -> bool:
    """Check if a specific user is currently online."""
    online_set = set(cache.get(ONLINE_USERS_KEY, []))
    return int(user_id) in online_set


def get_online_user_ids() -> list[int]:
    """Get list of all currently online user IDs."""
    return list(cache.get(ONLINE_USERS_KEY, []))
