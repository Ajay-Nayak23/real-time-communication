# Real-Time Communication Platform

A full-stack real-time communication platform supporting **real-time messaging and peer-to-peer audio/video communication**.

The project is being built incrementally using **Angular, Django, Django Channels, PostgreSQL, Redis and WebRTC**, with a strong focus on clean architecture, scalability, security and understanding the underlying communication technologies.

---

## 1. Project Vision

The goal is to build a communication platform where users can:

* Create an account and authenticate securely
* Discover other users
* Send and receive real-time messages
* View conversation history
* See online/offline status
* Make one-to-one audio calls
* Make one-to-one video calls
* Establish peer-to-peer WebRTC connections
* Use STUN for NAT traversal
* Fall back to TURN when direct peer-to-peer communication is not possible

The project will initially focus on a **Minimum Viable Product (MVP)** and then evolve toward a production-ready system.

---

# 2. MVP Scope

The first version of the platform will support:

### Authentication

* User registration
* User login
* Logout
* JWT-based authentication
* Basic user profile

### Messaging

* One-to-one conversations
* Real-time message delivery
* Message persistence
* Conversation history
* Message timestamps
* Basic read/unread state

### Presence

* Online/offline status
* Last seen information

### Calling

* One-to-one audio calling
* One-to-one video calling
* Call accept/reject
* Call end
* WebRTC peer-to-peer communication

### WebRTC Infrastructure

* ICE candidate exchange
* Host candidates
* STUN server configuration
* TURN server configuration
* WebRTC signaling through WebSockets

---

# 3. High-Level Architecture

```text
                         REAL-TIME COMMUNICATION PLATFORM
                                      |
                    +-----------------+-----------------+
                    |                                   |
                  CHAT                                CALLS
                    |                                   |
              WebSocket                              WebRTC
                    |                                   |
           Django Channels                    WebSocket Signaling
                    |                                   |
                  Redis                         ICE / STUN / TURN
                    |                                   |
               PostgreSQL                    Audio / Video Streams
```

## Detailed Architecture

```text
                         Angular Frontend
                               |
                 +-------------+-------------+
                 |                           |
              REST API                   WebSocket
                 |                           |
                 v                           v
          Django REST API              Django Channels
                 |                           |
                 |                          Redis
                 |                           |
                 +-------------+-------------+
                               |
                          PostgreSQL


                         CALLING SYSTEM
                               |
                         WebSocket
                         Signaling
                               |
                    +----------+----------+
                    |                     |
                 User A                 User B
                    |                     |
                    +------ WebRTC -------+
                           |
                  +--------+--------+
                  |                 |
                 STUN              TURN
                  |                 |
             Direct P2P       Relay Server
```

---

# 4. Technology Stack

## Frontend

* Angular
* TypeScript
* HTML
* SCSS
* RxJS
* Native WebSocket API
* Browser WebRTC APIs

## Backend

* Python 3.11+
* Django 5.2+
* Django REST Framework
* Django Channels
* ASGI
* Daphne

## Database

* PostgreSQL

SQLite may be used during the initial development stage, but PostgreSQL will be the target database for the application.

## Real-Time Infrastructure

* WebSockets
* Django Channels
* Redis
* Redis Channel Layer

## Calling

* WebRTC
* ICE
* STUN
* TURN

## Development / DevOps

* Git
* GitHub
* GitHub Issues
* GitHub Pull Requests
* Docker / Docker Compose
* Environment variables

---

# 5. Understanding the Communication Architecture

The project uses two different communication mechanisms.

## 5.1 WebSocket

WebSocket is used for **real-time communication between the frontend and backend**.

For example:

```text
User A
   |
   | "Hello"
   v
Angular
   |
   | WebSocket
   v
Django Channels
   |
   | WebSocket
   v
Angular
   |
   v
User B
```

WebSockets will be responsible for:

* Real-time messages
* Online/offline events
* Typing indicators
* Message delivery events
* WebRTC signaling
* Call events

---

# 6. WebRTC Architecture

WebRTC is used for **audio and video communication**.

The media should not normally pass through Django.

```text
User A                         User B
   |                              |
   |                              |
   |<-------- WebRTC ------------>|
   |                              |
 Audio / Video              Audio / Video
```

Django is responsible for signaling:

```text
User A
  |
  | SDP Offer
  v
Django
  |
  | SDP Offer
  v
User B
```

Then User B sends an SDP answer through Django.

ICE candidates are also exchanged through the signaling server.

After the connection is established, the peers attempt to communicate directly.

---

# 7. STUN

STUN helps a client discover its public-facing network address.

Example:

```text
Private IP
192.168.1.10:5000
       |
       | NAT
       v
Public IP
49.xx.xx.xx:62000
```

STUN does **not** relay audio/video.

It helps WebRTC determine whether a direct connection can be established.

---

# 8. TURN

TURN is used when a direct peer-to-peer WebRTC connection cannot be established.

```text
User A
   |
   | Media
   v
TURN Server
   |
   | Media
   v
User B
```

TURN acts as a relay.

The application should attempt direct communication first and use TURN when necessary.

---

# 9. ICE

ICE stands for:

**Interactive Connectivity Establishment**

ICE collects and tests possible connection paths.

Typical candidates include:

```text
ICE Candidates
      |
      +-- Host Candidate
      |
      +-- Server Reflexive Candidate
      |      |
      |      +-- STUN
      |
      +-- Relay Candidate
             |
             +-- TURN
```

The browser performs connectivity checks and selects a working path.

---

# 10. Project Structure

The target structure is:

```text
real-time-communication/
│
├── backend/
│   │
│   ├── manage.py
│   │
│   ├── commute/
│   │   ├── settings.py
│   │   ├── urls.py
│   │   ├── asgi.py
│   │   └── routing.py
│   │
│   ├── users/
│   ├── chat/
│   ├── calls/
│   └── ...
│
├── frontend/
│   │
│   ├── src/
│   │   ├── app/
│   │   ├── core/
│   │   ├── features/
│   │   └── shared/
│   │
│   └── package.json
│
├── docker-compose.yml
├── .gitignore
└── README.md
```

The exact structure may evolve as implementation progresses.

---

# 11. Development Roadmap

The project will be implemented incrementally.

## Phase 0 — Project Foundation

* [x] Initialize Git repository
* [x] Initialize Django backend
* [x] Initialize Angular frontend
* [x] Configure `.gitignore`
* [x] Create initial README
* [x] Push initial project to GitHub

---

# Phase 1 — Backend Foundation

### Issue #1 — Configure Django REST Framework

Tasks:

* Install Django REST Framework
* Add DRF configuration
* Verify API endpoint
* Establish API structure

Acceptance criteria:

* Django server starts successfully
* `/api/` endpoint is accessible
* DRF is correctly configured

---

### Issue #2 — Configure Django Channels

Tasks:

* Install Django Channels
* Configure ASGI
* Configure WebSocket routing
* Create initial WebSocket consumer

Acceptance criteria:

* Django accepts WebSocket connections
* WebSocket connection can be established from a browser/client

---

### Issue #3 — Create WebSocket Chat Prototype

Tasks:

* Create chat consumer
* Receive WebSocket messages
* Broadcast messages
* Return messages to connected clients

Acceptance criteria:

```text
Browser A
    |
    | Hello
    v
Django Channels
    |
    v
Browser B
```

Two browser sessions must be able to exchange messages in real time.

---

# Phase 2 — Authentication

### Issue #4 — Create User Authentication

Tasks:

* User registration
* Login
* Logout
* Password hashing
* JWT authentication
* Authentication APIs

Acceptance criteria:

* User can register
* User can login
* Protected APIs reject unauthenticated users
* Passwords are never stored in plain text

---

### Issue #5 — Authenticated WebSocket Connections

Tasks:

* Authenticate WebSocket connections
* Associate WebSocket connection with a user
* Reject unauthenticated connections

Acceptance criteria:

* Each WebSocket connection is associated with the correct user
* Unauthorized clients cannot access private chat channels

---

# Phase 3 — Database and Messaging

### Issue #6 — Configure PostgreSQL

Tasks:

* Add PostgreSQL configuration
* Configure environment variables
* Create database connection
* Remove dependency on SQLite for production

Acceptance criteria:

* Django successfully connects to PostgreSQL
* Database credentials are not committed to Git

---

### Issue #7 — Create Chat Data Models

Models should include:

```text
User
Conversation
ConversationParticipant
Message
```

A message should contain information such as:

```text
id
conversation
sender
content
created_at
is_read
```

---

### Issue #8 — Implement One-to-One Conversations

Tasks:

* Create conversation
* Add participants
* Retrieve conversation
* Prevent duplicate one-to-one conversations

---

### Issue #9 — Persist WebSocket Messages

Message flow:

```text
Angular
   |
   | WebSocket
   v
Django Channels
   |
   +------> PostgreSQL
   |
   +------> Receiver WebSocket
```

Acceptance criteria:

* Messages are saved
* Messages are delivered in real time
* Messages remain available after reconnecting

---

### Issue #10 — Conversation History API

Tasks:

* Retrieve conversation history
* Pagination
* Ordering
* Message timestamps

---

# Phase 4 — Redis and Presence

### Issue #11 — Configure Redis Channel Layer

Tasks:

* Add Redis
* Configure `channels_redis`
* Connect Django Channels to Redis
* Verify multi-process communication

---

### Issue #12 — Online / Offline Presence

Tasks:

* Detect WebSocket connection
* Mark user online
* Mark user offline
* Store last seen

---

### Issue #13 — Typing Indicator

Example:

```text
Ajay is typing...
```

Typing events should be transient WebSocket events and should not be stored as messages.

---

# Phase 5 — WebRTC Signaling

### Issue #14 — Design WebRTC Signaling Protocol

Define signaling events:

```text
CALL_INITIATE
CALL_ACCEPT
CALL_REJECT
CALL_END

SDP_OFFER
SDP_ANSWER

ICE_CANDIDATE
```

Define request/response payloads before implementation.

---

### Issue #15 — Implement WebRTC Signaling

Signaling flow:

```text
User A
   |
   | CALL_INITIATE
   v
Django
   |
   | CALL_INITIATE
   v
User B

User A
   |
   | SDP Offer
   v
Django
   |
   | SDP Offer
   v
User B

User B
   |
   | SDP Answer
   v
Django
   |
   | SDP Answer
   v
User A
```

---

# Phase 6 — Audio Calling

### Issue #16 — Implement Audio Calls

Tasks:

* Request microphone permission
* Create RTCPeerConnection
* Add audio tracks
* Exchange SDP
* Exchange ICE candidates
* Establish peer connection
* End call

Acceptance criteria:

Two authenticated users can make a one-to-one audio call.

---

# Phase 7 — Video Calling

### Issue #17 — Implement Video Calls

Tasks:

* Request camera permission
* Add video tracks
* Display local video
* Display remote video
* Handle camera/microphone controls

Acceptance criteria:

Two authenticated users can establish a one-to-one video call.

---

# Phase 8 — STUN and TURN

### Issue #18 — Configure STUN

Tasks:

* Configure STUN server
* Gather server-reflexive candidates
* Test WebRTC connection

---

### Issue #19 — Configure TURN

Tasks:

* Configure TURN server
* Configure credentials securely
* Test relay candidates
* Verify connection when direct P2P fails

Acceptance criteria:

WebRTC calls can fall back to TURN when required.

---

# Phase 9 — Production Hardening

### Issue #20 — HTTPS and Secure WebSockets

Configure:

```text
HTTP  → HTTPS
WS    → WSS
```

Production WebRTC should not depend on insecure browser contexts.

---

### Issue #21 — Dockerize Backend

Create:

```text
Dockerfile
docker-compose.yml
```

Services:

```text
backend
postgres
redis
```

---

### Issue #22 — Environment Configuration

Create configuration for:

```text
DATABASE_URL
SECRET_KEY
JWT_SECRET
REDIS_URL
STUN_SERVER
TURN_SERVER
TURN_USERNAME
TURN_PASSWORD
```

Secrets must never be committed.

---

### Issue #23 — Logging and Error Handling

Add:

* Structured backend logging
* WebSocket error handling
* API error responses
* WebRTC failure handling
* Client-side error messages

---

# Phase 10 — Testing

### Issue #24 — Backend Unit Tests

Test:

* Authentication
* Models
* APIs
* Chat consumers
* Permissions

---

### Issue #25 — WebSocket Tests

Test:

* Connection
* Authentication
* Message delivery
* Multiple users
* Disconnect/reconnect

---

### Issue #26 — WebRTC Testing

Test:

* Audio call
* Video call
* Call rejection
* Call termination
* ICE failure
* TURN fallback

---

# 12. Git Branching Strategy

The `main` branch should always contain stable code.

Use feature branches:

```text
main
 |
 +-- feature/django-channels
 |
 +-- feature/authentication
 |
 +-- feature/chat-messaging
 |
 +-- feature/redis
 |
 +-- feature/webrtc-signaling
 |
 +-- feature/audio-calling
 |
 +-- feature/video-calling
```

Branch naming:

```text
feature/<feature-name>
bugfix/<bug-name>
chore/<task-name>
```

Examples:

```text
feature/websocket-chat
feature/user-authentication
feature/webrtc-signaling
bugfix/message-duplication
chore/docker-setup
```

---

# 13. Commit Convention

Use conventional commit messages.

Examples:

```text
feat: add Django Channels support
feat: implement one-to-one messaging
feat: add WebRTC signaling
fix: prevent duplicate messages
fix: handle websocket disconnect
chore: configure Redis
test: add chat consumer tests
docs: update WebRTC architecture
```

---

# 14. Pull Request Guidelines

Every feature should preferably follow:

```text
GitHub Issue
      ↓
Feature Branch
      ↓
Implementation
      ↓
Tests
      ↓
Commit
      ↓
Pull Request
      ↓
Review
      ↓
Merge
```

A Pull Request should contain:

* What changed
* Why it changed
* Related issue
* Testing performed
* Screenshots where applicable
* Known limitations

---

# 15. AI Agent / Antigravity Development Guidelines

AI agents working on this repository must follow these rules.

## Rule 1 — Understand Before Modifying

Before changing code:

1. Inspect the existing project structure.
2. Read relevant files.
3. Understand existing architecture.
4. Check the related GitHub Issue.
5. Avoid unnecessary refactoring.

---

## Rule 2 — Work Issue by Issue

Agents should work against a specific GitHub Issue.

Do not implement multiple unrelated features in one change.

For example:

```text
Issue #2
Django Channels setup
```

should not also implement:

```text
Authentication
PostgreSQL
WebRTC
Redis
```

---

## Rule 3 — Preserve Existing Functionality

Before modifying code:

```text
Understand existing behavior
        ↓
Make minimal changes
        ↓
Run tests
        ↓
Verify existing functionality
```

---

## Rule 4 — No Secrets

Never commit:

```text
.env
API keys
Passwords
JWT secrets
TURN credentials
Database passwords
Private keys
```

Use environment variables.

---

## Rule 5 — Explain Architectural Decisions

When introducing a technology, document why it is needed.

Examples:

```text
Why Django Channels?
Why Redis?
Why WebSocket?
Why WebRTC?
Why STUN?
Why TURN?
```

---

## Rule 6 — Prefer Simple Solutions First

Do not introduce unnecessary infrastructure.

Development should progress approximately as:

```text
Django
   ↓
Django REST Framework
   ↓
Django Channels
   ↓
WebSocket Chat
   ↓
PostgreSQL
   ↓
Redis
   ↓
WebRTC
   ↓
STUN
   ↓
TURN
   ↓
Production infrastructure
```

---

## Rule 7 — Test Every Feature

Every meaningful feature should include appropriate testing.

An agent should not claim a feature is complete without verifying it.

---

# 16. Definition of Done

A GitHub Issue is considered complete only when:

* [ ] Implementation is complete
* [ ] Existing functionality still works
* [ ] Relevant tests pass
* [ ] Error handling is implemented
* [ ] No secrets are committed
* [ ] Code is reasonably documented
* [ ] README/documentation is updated if required
* [ ] Changes are committed
* [ ] Pull Request is created
* [ ] Pull Request is reviewed
* [ ] Issue is closed after merge

---

# 17. Current Development Status

## Completed

* [x] Git repository initialized
* [x] Angular application initialized
* [x] Django application initialized
* [x] Root `.gitignore`
* [x] Initial project commit
* [x] GitHub repository connected

## In Progress

* [ ] GitHub Issue creation
* [ ] Project milestones
* [ ] Backend WebSocket architecture

## Upcoming

* [ ] Django REST Framework
* [ ] Django Channels
* [ ] WebSocket messaging
* [ ] PostgreSQL
* [ ] Authentication
* [ ] Redis
* [ ] Presence
* [ ] WebRTC signaling
* [ ] Audio calling
* [ ] Video calling
* [ ] STUN
* [ ] TURN
* [ ] Docker
* [ ] Testing
* [ ] Production deployment

---

# 18. MVP Definition

The MVP is complete when the following scenario works end-to-end:

```text
User A
   |
   | Register / Login
   v
Platform
   |
   | Find User B
   v
Chat
   |
   | "Hello"
   v
WebSocket
   |
   v
User B
```

And:

```text
User A
   |
   | Start Video Call
   v
WebSocket Signaling
   |
   v
User B
   |
   | Accept
   v
WebRTC
   |
   +------ STUN ------+
   |                  |
   |   Direct P2P     |
   |                  |
   +------------------+
            |
       If P2P fails
            |
            v
           TURN
```

The MVP should provide a reliable one-to-one communication experience before additional features such as group calls, file sharing, push notifications and advanced messaging are considered.

---

# 19. Future Enhancements

After the MVP:

* Group conversations
* Group video calls
* File sharing
* Image sharing
* Voice messages
* Message reactions
* Message editing
* Message deletion
* Reply/threads
* Push notifications
* Call history
* Missed calls
* Screen sharing
* Background blur
* Noise suppression
* End-to-end encryption
* Message search
* Message pagination
* Rate limiting
* Abuse prevention
* Horizontal scaling
* Monitoring and observability

These features should **not be implemented before the MVP is stable**.

---

# 20. Guiding Principle

> **Build it simply. Understand it deeply. Test it properly. Scale it when necessary.**

The primary goal of this project is not only to create a working communication platform, but also to understand how modern real-time communication systems work internally:

```text
HTTP
 ↓
REST APIs
 ↓
WebSockets
 ↓
Django Channels
 ↓
Redis
 ↓
WebRTC
 ↓
ICE
 ↓
STUN
 ↓
TURN
 ↓
Production Architecture
```

Each layer should be introduced only when the previous layer is understood and working correctly.
