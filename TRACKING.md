# Project Roadmap & Issue Progress Tracker

This file tracks the implementation progress of all 51 GitHub issues across the 11 development milestones.

**Overall Progress:** `21 / 51 completed` (41.2%)

---

## 1. Project Foundation `(4/4)`

- [x] **[#1](https://github.com/Ajay-Nayak23/real-time-communication/issues/1)** — `RTC-001`: Initialize repository and project workspace structure `(Completed)`
- [x] **[#2](https://github.com/Ajay-Nayak23/real-time-communication/issues/2)** — `RTC-002`: Setup Angular frontend application architecture and routing `(Completed)`
- [x] **[#3](https://github.com/Ajay-Nayak23/real-time-communication/issues/3)** — `RTC-003`: Setup Django backend application and development settings `(Completed)`
- [x] **[#4](https://github.com/Ajay-Nayak23/real-time-communication/issues/4)** — `RTC-004`: Create local development environment documentation and onboarding guide `(Completed)`

---

## 2. Backend Foundation & Initial Vertical Slice `(4/4)`

- [x] **[#5](https://github.com/Ajay-Nayak23/real-time-communication/issues/5)** — `RTC-005`: Setup Django REST Framework and API URL routing architecture `(Completed)`
- [x] **[#6](https://github.com/Ajay-Nayak23/real-time-communication/issues/6)** — `RTC-006`: Implement backend health-check REST API `(Completed)`
- [x] **[#7](https://github.com/Ajay-Nayak23/real-time-communication/issues/7)** — `RTC-007`: Connect Angular frontend to Django backend health API `(Completed)`
- [x] **[#8](https://github.com/Ajay-Nayak23/real-time-communication/issues/8)** — `RTC-008`: Configure CORS middleware for local frontend-backend development `(Completed)`

---

## 3. Authentication `(5/5)`

- [x] **[#9](https://github.com/Ajay-Nayak23/real-time-communication/issues/9)** — `RTC-009`: Create Django users app and custom user model `(Completed)`
  > **Useful Commands:**
  > - Generate migrations: `python manage.py makemigrations users`
  > - Apply migrations: `python manage.py migrate`
  > - Create superuser (interactive): `python manage.py createsuperuser`
  > - Run user tests: `python manage.py test users`
- [x] **[#10](https://github.com/Ajay-Nayak23/real-time-communication/issues/10)** — `RTC-010`: Implement user registration REST API endpoint with validation `(Completed)`
  > **Useful Commands:**
  > - Run registration tests: `python manage.py test users.tests.UserRegistrationAPITests`
  > - Test via cURL:
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/auth/register/ -H "Content-Type: application/json" -d "{\"email\": \"user@example.com\", \"name\": \"Ajay\", \"password\": \"StrongPassword123!\"}"
  >   ```
- [x] **[#11](https://github.com/Ajay-Nayak23/real-time-communication/issues/11)** — `RTC-011`: Implement JWT authentication, login, and token refresh endpoints `(Completed)`
  > **Useful Commands:**
  > - Run JWT tests: `python manage.py test users.tests.JWTAuthenticationAPITests`
  > - Login:
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/auth/login/ -H "Content-Type: application/json" -d "{\"email\": \"user@example.com\", \"password\": \"StrongPassword123!\"}"
  >   ```
  > - Refresh Token:
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/auth/token/refresh/ -H "Content-Type: application/json" -d "{\"refresh\": \"<REFRESH_TOKEN>\"}"
  >   ```
  > - Logout (Blacklist Refresh Token):
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/auth/logout/ -H "Content-Type: application/json" -H "Authorization: Bearer <ACCESS_TOKEN>" -d "{\"refresh\": \"<REFRESH_TOKEN>\"}"
  >   ```
- [x] **[#12](https://github.com/Ajay-Nayak23/real-time-communication/issues/12)** — `RTC-012`: Build Angular authentication service, JWT interceptor, and login/register UI `(Completed)`
  > **Useful Commands & Paths:**
  > - Core Auth Service: `frontend/src/app/core/services/auth.service.ts`
  > - JWT Interceptor: `frontend/src/app/core/interceptors/jwt.interceptor.ts`
  > - Features: `/login` (`LoginComponent`), `/register` (`RegisterComponent`)
  > - Run frontend unit tests: `npm test -- --watch=false`
  > - Build frontend: `npm run build`
- [x] **[#13](https://github.com/Ajay-Nayak23/real-time-communication/issues/13)** — `RTC-013`: Implement authentication error handling and Angular route guards `(Completed)`
  > **Useful Commands & Paths:**
  > - Route Guards: `frontend/src/app/core/guards/auth.guard.ts`, `frontend/src/app/core/guards/public.guard.ts`
  > - Error Interceptor: `frontend/src/app/core/interceptors/error.interceptor.ts` (401 catch & token refresh queuing)
  > - Alert Service: `frontend/src/app/core/services/alert.service.ts`
  > - Protected Routes: `/chat`, `/profile`
  > - Run all frontend tests: `npm test -- --watch=false`

---

## 4. Database and Messaging `(8/8)`

- [x] **[#14](https://github.com/Ajay-Nayak23/real-time-communication/issues/14)** — `RTC-014`: Implement user profile retrieval and update API `(Completed)`
  > **Useful Commands & Examples:**
  > - Retrieve Profile:
  >   ```bash
  >   curl -X GET http://127.0.0.1:8000/api/users/me/ -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Update Profile:
  >   ```bash
  >   curl -X PATCH http://127.0.0.1:8000/api/users/me/ -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"name\": \"Updated Name\", \"bio\": \"Software Engineer\"}"
  >   ```
  > - Run profile tests: `python manage.py test users.tests.UserProfileAPITests`
- [x] **[#15](https://github.com/Ajay-Nayak23/real-time-communication/issues/15)** — `RTC-015`: Implement user discovery directory list API `(Completed)`
  > **Useful Commands & Examples:**
  > - List Users (Paginated):
  >   ```bash
  >   curl -X GET http://127.0.0.1:8000/api/users/ -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Search by Name or Email:
  >   ```bash
  >   curl -X GET "http://127.0.0.1:8000/api/users/?search=john" -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Run directory tests: `python manage.py test users.tests.UserDirectoryAPITests`
- [x] **[#16](https://github.com/Ajay-Nayak23/real-time-communication/issues/16)** — `RTC-017`: Create Django chat app with Conversation, Participant, and Message models `(Completed)`
  > **Useful Commands & Paths:**
  > - Models: `backend/chat/models.py` (`Conversation`, `ConversationParticipant`, `Message`)
  > - Migrations: `backend/chat/migrations/0001_initial.py`
  > - Admin: `backend/chat/admin.py`
  > - Run chat model tests: `python manage.py test chat`
- [x] **[#17](https://github.com/Ajay-Nayak23/real-time-communication/issues/17)** — `RTC-018`: Implement one-to-one conversation management REST API `(Completed)`
  > **Useful Commands & Examples:**
  > - List Conversations:
  >   ```bash
  >   curl -X GET http://127.0.0.1:8000/api/chat/conversations/ -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Start / Fetch One-to-One Conversation:
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/chat/conversations/ -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"recipient_id\": 2}"
  >   ```
  > - Retrieve Conversation Details:
  >   ```bash
  >   curl -X GET http://127.0.0.1:8000/api/chat/conversations/<id>/ -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Run conversation tests: `python manage.py test chat.tests.ConversationAPITests`
- [x] **[#18](https://github.com/Ajay-Nayak23/real-time-communication/issues/18)** — `RTC-019`: Implement paginated message history REST API `(Completed)`
  > **Useful Commands & Examples:**
  > - Fetch Messages (Cursor Pagination for Infinite Scroll):
  >   ```bash
  >   curl -X GET http://127.0.0.1:8000/api/chat/conversations/<id>/messages/ -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Fetch Messages (Page-number Pagination):
  >   ```bash
  >   curl -X GET "http://127.0.0.1:8000/api/chat/conversations/<id>/messages/?page=1&page_size=20" -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Send Message via REST:
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/chat/conversations/<id>/messages/ -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" -d "{\"content\": \"Hello world!\"}"
  >   ```
- [x] **[#19](https://github.com/Ajay-Nayak23/real-time-communication/issues/19)** — `RTC-020`: Build Angular chat UI components (conversation list, message window, composer) `(Completed)`
  > **Useful Commands & Paths:**
  > - Main Chat View: `frontend/src/app/features/chat/chat.component.ts`
  > - Conversation List Sidebar: `frontend/src/app/features/chat/components/conversation-list/`
  > - Message Thread Window: `frontend/src/app/features/chat/components/message-window/`
  > - Message Composer Input: `frontend/src/app/features/chat/components/message-input/`
  > - Chat Service: `frontend/src/app/core/services/chat.service.ts`
  > - Run frontend unit tests: `npm test -- --watch=false`
- [x] **[#20](https://github.com/Ajay-Nayak23/real-time-communication/issues/20)** — `RTC-021`: Configure Django Channels and implement real-time WebSocket chat consumer `(Completed)`
  > **Useful Commands & Paths:**
  > - ASGI Application: `backend/commute/asgi.py`
  > - WebSocket Route: `ws://127.0.0.1:8000/ws/chat/<conversation_id>/?token=<ACCESS_TOKEN>`
  > - Consumer: `backend/chat/consumers.py` (`ChatConsumer`)
  > - JWT ASGI Middleware: `backend/chat/middleware.py` (`JWTAuthMiddlewareStack`)
  > - Routing: `backend/chat/routing.py`
  > - Angular Service: `frontend/src/app/core/services/chat.service.ts`
  > - Run WebSocket tests: `python manage.py test chat.tests.ChatConsumerTests`
- [x] **[#21](https://github.com/Ajay-Nayak23/real-time-communication/issues/21)** — `RTC-022`: Implement unread message tracking and read status indicators `(Completed)`
  > **Useful Commands & Examples:**
  > - Mark Messages Read:
  >   ```bash
  >   curl -X POST http://127.0.0.1:8000/api/chat/conversations/<id>/read/ -H "Authorization: Bearer <ACCESS_TOKEN>"
  >   ```
  > - Mark Messages Read via WebSocket:
  >   ```json
  >   { "type": "mark_read" }
  >   ```
  > - Models: `backend/chat/models.py` (`Message.read_at`, `ConversationParticipant.last_read_at`)
  > - Run read tests: `python manage.py test chat.tests.ConversationMarkReadAPITests`

---

## 5. Redis and Presence `(0/4)`

- [ ] **[#22](https://github.com/Ajay-Nayak23/real-time-communication/issues/22)** — `RTC-030`: Configure Redis as Django Channels channel layer for local development
- [ ] **[#23](https://github.com/Ajay-Nayak23/real-time-communication/issues/23)** — `RTC-016`: Implement real-time online/offline presence tracking and broadcasts
- [ ] **[#24](https://github.com/Ajay-Nayak23/real-time-communication/issues/24)** — `RTC-023`: Implement real-time typing indicators over WebSocket
- [ ] **[#25](https://github.com/Ajay-Nayak23/real-time-communication/issues/25)** — `RTC-031`: Validate multi-instance WebSocket horizontal scaling with Redis channel layer

---

## 6. WebRTC Signaling `(0/4)`

- [ ] **[#26](https://github.com/Ajay-Nayak23/real-time-communication/issues/26)** — Design WebRTC signaling protocol specification and message schemas
- [ ] **[#27](https://github.com/Ajay-Nayak23/real-time-communication/issues/27)** — `RTC-024`: Create Django calls app with Call session and state data model
- [ ] **[#28](https://github.com/Ajay-Nayak23/real-time-communication/issues/28)** — `RTC-025`: Implement WebRTC signaling WebSocket consumer and event dispatcher
- [ ] **[#29](https://github.com/Ajay-Nayak23/real-time-communication/issues/29)** — `RTC-026`: Implement Angular WebRTC service for peer connection and signaling management

---

## 7. Audio Calling `(0/4)`

- [ ] **[#30](https://github.com/Ajay-Nayak23/real-time-communication/issues/30)** — Implement incoming and outgoing audio call signaling flow
- [ ] **[#31](https://github.com/Ajay-Nayak23/real-time-communication/issues/31)** — `RTC-027`: Build incoming call notification modal and accept/reject controls
- [ ] **[#32](https://github.com/Ajay-Nayak23/real-time-communication/issues/32)** — Build audio call active screen with microphone mute/unmute and call termination
- [ ] **[#33](https://github.com/Ajay-Nayak23/real-time-communication/issues/33)** — `RTC-029`: Implement call history tracking, persistence, and REST API

---

## 8. Video Calling `(0/3)`

- [ ] **[#34](https://github.com/Ajay-Nayak23/real-time-communication/issues/34)** — Implement video stream capture, media track negotiation, and peer connection setup
- [ ] **[#35](https://github.com/Ajay-Nayak23/real-time-communication/issues/35)** — `RTC-028`: Build video call interface with local/remote video grids and camera toggle
- [ ] **[#36](https://github.com/Ajay-Nayak23/real-time-communication/issues/36)** — Implement WebRTC media renegotiation and stream layout responsiveness

---

## 9. STUN and TURN `(0/3)`

- [ ] **[#37](https://github.com/Ajay-Nayak23/real-time-communication/issues/37)** — Configure public STUN server for NAT discovery and candidate gathering
- [ ] **[#38](https://github.com/Ajay-Nayak23/real-time-communication/issues/38)** — Configure TURN server (coturn) for relay fallback in symmetric NAT environments
- [ ] **[#39](https://github.com/Ajay-Nayak23/real-time-communication/issues/39)** — Implement backend API for dynamic ICE server configuration and ephemeral TURN credentials

---

## 10. Production Hardening `(0/8)`

- [ ] **[#40](https://github.com/Ajay-Nayak23/real-time-communication/issues/40)** — `RTC-032`: Enforce granular backend authorization and object-level permissions
- [ ] **[#41](https://github.com/Ajay-Nayak23/real-time-communication/issues/41)** — `RTC-033`: Configure environment variables and secure secrets management
- [ ] **[#42](https://github.com/Ajay-Nayak23/real-time-communication/issues/42)** — `RTC-034`: Configure production security headers, HTTPS, WSS, and CORS policies
- [ ] **[#43](https://github.com/Ajay-Nayak23/real-time-communication/issues/43)** — `RTC-039`: Dockerize Django backend application with Daphne ASGI server
- [ ] **[#44](https://github.com/Ajay-Nayak23/real-time-communication/issues/44)** — `RTC-040`: Dockerize Angular frontend application with Nginx production container
- [ ] **[#45](https://github.com/Ajay-Nayak23/real-time-communication/issues/45)** — `RTC-041`: Create Docker Compose multi-service environment (Postgres, Redis, Daphne, Angular)
- [ ] **[#46](https://github.com/Ajay-Nayak23/real-time-communication/issues/46)** — `RTC-042`: Set up GitHub Actions CI pipeline for automated linting, test suites, and build validation
- [ ] **[#47](https://github.com/Ajay-Nayak23/real-time-communication/issues/47)** — `RTC-043`: Establish production deployment configuration, environment checklist, and monitoring guidelines

---

## 11. Testing `(0/4)`

- [ ] **[#48](https://github.com/Ajay-Nayak23/real-time-communication/issues/48)** — `RTC-035`: Implement Django backend unit and integration test suite
- [ ] **[#49](https://github.com/Ajay-Nayak23/real-time-communication/issues/49)** — `RTC-036`: Implement automated test suite for Django Channels WebSocket and WebRTC signaling consumers
- [ ] **[#50](https://github.com/Ajay-Nayak23/real-time-communication/issues/50)** — `RTC-037`: Implement Angular unit and component test suite
- [ ] **[#51](https://github.com/Ajay-Nayak23/real-time-communication/issues/51)** — `RTC-038`: Implement end-to-end user journey test suite
