# Backend Architecture & Guide — Real-Time Communication Platform

The backend is built with **Django 5.2**, **Django REST Framework (DRF)**, and **Django Channels 4** served by the **Daphne ASGI** server. It manages REST APIs, JWT authentication with token rotation, database persistence, and WebSocket protocol routing for chat, presence, and WebRTC signaling.

---

## 1. Technology Stack

* **Language & Runtime:** Python 3.11+
* **Framework:** Django 5.2 (LTS)
* **API Toolkit:** Django REST Framework (DRF)
* **Real-Time Engine:** Django Channels 4.x
* **ASGI Server:** Daphne
* **Database:** SQLite (default for development) / PostgreSQL (production-ready)
* **Channel Layer:** In-Memory (development default) / Redis (`channels-redis`)
* **Authentication:** JSON Web Tokens (`djangorestframework-simplejwt`) with Token Blacklisting

---

## 2. Directory Structure

```text
backend/
├── commute/                  # Core Django project configuration
│   ├── settings.py           # Application settings, Channel layers, JWT configs
│   ├── asgi.py               # ASGI entrypoint routing HTTP and WebSockets
│   ├── wsgi.py               # WSGI fallback entrypoint
│   ├── urls.py               # Top-level URL routing
│   ├── api_urls.py           # /api/ URL router (auth, users, calls, chat)
│   ├── views.py              # Health check endpoint (/api/health/)
│   └── tests.py              # Project-level integration tests
│
├── users/                    # User identity, authentication, and profiles
│   ├── models.py             # Custom User model (AUTH_USER_MODEL)
│   ├── views.py              # Register, Login, Refresh, Profile Me, Directory views
│   ├── serializers.py        # User & Token serializers
│   ├── urls.py               # /api/auth/ endpoints
│   ├── api_urls.py           # /api/users/ endpoints
│   └── tests.py              # User authentication test suite
│
├── chat/                     # 1-to-1 Messaging, History, and Presence
│   ├── models.py             # Conversation, ConversationParticipant, Message
│   ├── consumers.py          # ChatConsumer & PresenceConsumer (WebSockets)
│   ├── routing.py            # /ws/chat/<id>/ and /ws/presence/ URL routing
│   ├── middleware.py         # JWTAuthMiddlewareStack for WebSocket authentication
│   ├── views.py              # Conversation & Message REST ViewSets
│   ├── serializers.py        # Chat & Message DRF serializers
│   ├── urls.py               # /api/chat/ REST routes
│   └── tests.py              # Messaging & presence test suite
│
├── calls/                    # WebRTC Audio & Video Calling Signaling
│   ├── models.py             # Call session records, duration, status, call_type
│   ├── consumers.py          # CallSignalingConsumer (WebRTC SDP & ICE exchange)
│   ├── routing.py            # /ws/calls/ WebSocket routing
│   ├── views.py              # Call history & call detail REST endpoints
│   ├── serializers.py        # Call history DRF serializers
│   ├── urls.py               # /api/calls/ REST routes
│   └── tests.py              # WebRTC signaling & call history test suite
│
├── manage.py                 # Django management script
└── requirements.txt          # Python dependencies
```

---

## 3. Database Models & Schema

### `users.User`
* Extends `AbstractBaseUser` and `PermissionsMixin`.
* Primary key: `id` (BigAutoField).
* Key fields: `email` (unique identifier), `name`, `profile_image`, `bio`, `is_online`, `last_seen`.

### `chat.Conversation`
* Represents a one-to-one conversation between two users.
* Tracked via `chat.ConversationParticipant` (User, Conversation, `unread_count`, `last_read_at`).

### `chat.Message`
* Stores conversation messages.
* Key fields: `conversation`, `sender`, `content`, `message_type` ('text', 'image', 'system'), `is_read`, `created_at`.

### `calls.Call`
* Persistent record of all audio and video call sessions.
* Key fields:
  * `uuid`: Public unique identifier.
  * `caller`: User who initiated the call.
  * `callee`: User receiving the call.
  * `call_type`: `'audio'` or `'video'`.
  * `status`: `'ringing'`, `'ongoing'`, `'rejected'`, `'missed'`, `'ended'`, `'busy'`, `'failed'`.
  * `duration`: Call duration in seconds (computed upon call termination).
  * `started_at`, `ended_at`, `created_at`.

---

## 4. WebSocket Routing & Consumers

WebSocket connections are authenticated via `chat.middleware.JWTAuthMiddlewareStack`, which extracts the JWT access token from the URL query parameter (`?token=<JWT>`) or headers, validates it, and attaches the authenticated `user` to the Channels `scope`.

| WebSocket Endpoint | Consumer | Description |
| ------------------ | -------- | ----------- |
| `/ws/presence/` | `PresenceConsumer` | Broadcasts user online/offline status to all active users. |
| `/ws/chat/<conversation_id>/` | `ChatConsumer` | Handles real-time messaging, typing indicators, and read receipts within a conversation. |
| `/ws/calls/` | `CallSignalingConsumer` | Manages 1-on-1 WebRTC signaling: call invites, accept/reject, SDP offers, SDP answers, ICE candidates, and call termination. |

---

## 5. REST API Reference

All REST endpoints are rooted under `/api/`:

| Endpoint | Method | Description | Auth Required |
| -------- | ------ | ----------- | ------------- |
| `/api/health/` | `GET` | Health check (`{"status": "ok"}`) | No |
| `/api/auth/register/` | `POST` | User registration | No |
| `/api/auth/login/` | `POST` | User login (returns access & refresh JWT) | No |
| `/api/auth/refresh/` | `POST` | Refresh access token | No |
| `/api/auth/logout/` | `POST` | Blacklist refresh token & logout | Yes |
| `/api/users/me/` | `GET`, `PATCH` | Retrieve or update current user profile | Yes |
| `/api/users/` | `GET` | Search and discover registered users | Yes |
| `/api/conversations/` | `GET`, `POST` | List conversations or create new thread | Yes |
| `/api/conversations/<id>/messages/` | `GET`, `POST`| Fetch message history or send message | Yes |
| `/api/calls/history/` | `GET` | Paginated audio/video call history | Yes |
| `/api/calls/<id>/` | `GET` | Details of a single call session | Yes |

---

## 6. How to Run the Backend

```bash
# 1. Activate Python virtual environment
# Windows:
.\.venv\Scripts\activate
# Linux/macOS:
# source .venv/bin/activate

# 2. Run migrations
python manage.py migrate

# 3. Start Daphne ASGI Server
python manage.py runserver 127.0.0.1:8000
```

---

## 7. Running Backend Tests

```bash
python manage.py test users chat calls commute
```
