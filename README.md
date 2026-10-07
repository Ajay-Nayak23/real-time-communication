# Real-Time Communication Platform

A full-stack real-time communication platform built from scratch using Angular and Django.

The project is designed as an SDE-style production project, covering authentication, REST APIs, real-time messaging, WebSockets, WebRTC-based audio/video calling, persistence, security, testing, and deployment.

The goal is not only to build the application, but also to understand the architecture and engineering decisions well enough to explain them in an SDE interview.

---

# 1. Project Vision

Build a web application where authenticated users can:

* Create an account and log in
* Manage their profile
* See other users and their online/offline status
* Start one-to-one conversations
* Exchange messages in real time
* View previous messages
* Receive real-time notifications
* Start audio/video calls
* Accept or reject incoming calls
* End active calls
* See call history

The application will eventually support a scalable real-time architecture using:

* Angular
* Django
* Django REST Framework
* Django Channels
* WebSockets
* WebRTC
* PostgreSQL
* Redis
* JWT Authentication
* Docker
* GitHub Actions
* HTTPS/WSS

---

# 2. Project Goals

## Primary Goals

1. Build a complete full-stack application from scratch.
2. Understand frontend/backend communication.
3. Learn REST API design.
4. Learn JWT-based authentication.
5. Learn WebSockets and real-time communication.
6. Understand WebRTC signaling and peer-to-peer communication.
7. Understand Redis as a real-time infrastructure component.
8. Follow Git/GitHub issue, branch, PR, and sprint workflows.
9. Write tests for important functionality.
10. Deploy the application.
11. Be able to explain the complete architecture in an SDE interview.

## Learning Goals

This project should strengthen:

* Angular
* Django
* Django REST Framework
* PostgreSQL
* Redis
* WebSockets
* WebRTC
* API design
* Authentication
* System design
* Git/GitHub
* Testing
* Docker
* Deployment

---

# 3. Scope

## MVP

The MVP will contain:

* User registration
* User login/logout
* JWT authentication
* User profile
* User list
* Online/offline status
* One-to-one conversations
* Persistent chat history
* Real-time messaging
* Basic notifications
* One-to-one audio/video calling
* Incoming call notification
* Accept/reject/end call
* Basic call history

## Future / Stretch Features

These will not block the MVP:

* Group chat
* Group video calls
* Message reactions
* Message editing
* Message deletion
* Typing indicators
* Read receipts
* File/image sharing
* Message search
* Push notifications
* Screen sharing
* Call recording
* End-to-end encrypted messaging
* Advanced presence states
* Redis-backed distributed WebSocket scaling
* Kubernetes deployment

---

# 4. Functional Requirements

Functional requirements describe **what the system should do**.

---

## FR-01: User Registration

The system shall allow a new user to create an account.

Required information:

* Name
* Email
* Password

Rules:

* Email must be unique.
* Password must satisfy minimum security requirements.
* Password must never be stored as plain text.
* Invalid registration requests must return meaningful errors.

---

## FR-02: User Login

The system shall allow registered users to log in.

On successful login:

* Access token shall be generated.
* Refresh token shall be generated.
* User shall be authenticated on the Angular frontend.

Invalid credentials shall return an appropriate error.

---

## FR-03: User Logout

The user shall be able to log out.

Logout shall clear client-side authentication state and invalidate/revoke refresh credentials according to the selected authentication strategy.

---

## FR-04: User Profile

Authenticated users shall be able to:

* View their profile
* Update their name
* Update profile information
* Upload/change profile picture in a future iteration

---

## FR-05: User Discovery

An authenticated user shall be able to see other registered users.

The user list shall display:

* Name
* Profile picture/avatar
* Online/offline status

A user shall not see sensitive authentication information.

---

## FR-06: Online / Offline Presence

The system shall maintain a user's basic presence state.

Possible initial states:

* ONLINE
* OFFLINE

The status shall be updated when the user connects/disconnects from the real-time service.

---

## FR-07: Conversation Creation

An authenticated user shall be able to start a one-to-one conversation with another user.

Rules:

* A conversation shall contain two users for the MVP.
* Duplicate conversations between the same two users should be prevented.

---

## FR-08: Conversation List

The user shall be able to see their conversations.

Each conversation should display:

* Other user's name
* Other user's online status
* Last message
* Last message timestamp
* Unread message count

---

## FR-09: Message Sending

A user shall be able to send text messages.

Each message shall contain at minimum:

* Message ID
* Conversation ID
* Sender ID
* Message content
* Created timestamp

---

## FR-10: Message Persistence

Messages shall be persisted in PostgreSQL.

Refreshing the browser must not remove chat history.

Users shall only be able to access messages belonging to conversations in which they participate.

---

## FR-11: Real-Time Messaging

Messages shall be delivered in real time using WebSockets.

Expected flow:

```text
Angular
   |
   | WebSocket
   v
Django Channels
   |
   v
Chat Consumer
   |
   v
Other Connected User
```

A user should not need to refresh the browser to receive a new message.

---

## FR-12: Message Notifications

When a user receives a new message while viewing another conversation, the application shall display a notification or unread indicator.

---

## FR-13: Typing Indicator

Stretch feature.

The application may display:

```text
Ajay is typing...
```

This will use WebSocket events and should not create persistent database records.

---

## FR-14: Read Receipts

Stretch feature.

The system may support:

* SENT
* DELIVERED
* READ

Message delivery state shall be updated using real-time events.

---

## FR-15: Start Audio/Video Call

An authenticated user shall be able to initiate an audio/video call with another user.

The call shall use WebRTC for peer-to-peer media communication.

---

## FR-16: Incoming Call

The recipient shall receive a real-time incoming call notification containing:

* Caller name
* Caller avatar
* Call type

Call types:

* AUDIO
* VIDEO

---

## FR-17: Accept Call

The recipient shall be able to accept an incoming call.

The system shall establish WebRTC signaling and attempt to establish the peer connection.

---

## FR-18: Reject Call

The recipient shall be able to reject an incoming call.

The caller shall receive the rejection state in real time.

---

## FR-19: End Call

Either participant shall be able to terminate an active call.

Both clients shall receive the updated call state.

---

## FR-20: Call History

The application shall maintain basic call history.

Each call record may contain:

* Caller
* Recipient
* Call type
* Start time
* End time
* Call status
* Duration

Possible statuses:

* MISSED
* REJECTED
* COMPLETED
* FAILED

---

## FR-21: Authorization

Users shall only be able to:

* View their own profile
* Modify their own profile
* View conversations they belong to
* Send messages to conversations they belong to
* Participate in calls involving themselves

Unauthorized access shall return an appropriate HTTP error.

---

# 5. Non-Functional Requirements

Non-functional requirements describe **how the system should behave**.

---

## NFR-01: Security

The application shall:

* Hash user passwords.
* Never store plain-text passwords.
* Protect authenticated API endpoints.
* Use JWT authentication.
* Validate all user input.
* Enforce authorization on protected resources.
* Use HTTPS in production.
* Use secure WebSocket connections (`WSS`) in production.
* Avoid exposing secrets in source control.
* Store configuration/secrets using environment variables.

---

## NFR-02: Performance

For the MVP, the following targets should be used as engineering goals:

### REST APIs

Target:

```text
p95 response time < 300 ms
```

for normal API operations under expected development load.

### Real-Time Messages

Target:

```text
Message delivery < 1 second
```

under normal network conditions.

### Call Setup

Target:

```text
WebRTC call establishment < 5 seconds
```

under normal network conditions.

These are targets, not hard guarantees.

---

## NFR-03: Scalability

The architecture should allow future horizontal scaling.

The real-time layer should eventually support:

```text
Client
   |
Load Balancer
   |
+---------+---------+
|                   |
Django Instance  Django Instance
|                   |
+---------+---------+
          |
        Redis
```

Redis will later act as the shared channel layer for multiple Django instances.

---

## NFR-04: Availability

The production system should be designed so that failure of one application instance does not require the entire service to be unavailable.

The MVP will focus primarily on correct functionality rather than high availability.

---

## NFR-05: Maintainability

The codebase shall:

* Follow clear project structure.
* Separate frontend and backend responsibilities.
* Separate Django applications by business responsibility.
* Avoid duplicated business logic.
* Use reusable Angular components/services.
* Use reusable backend services where appropriate.
* Follow consistent naming conventions.

---

## NFR-06: Testability

Critical functionality shall have automated tests.

Backend tests should cover:

* Registration
* Login
* Authentication
* Authorization
* Conversation creation
* Message APIs
* WebSocket behavior
* Call signaling

Frontend tests should cover:

* Authentication components
* Chat components
* Services
* Important state transitions

---

## NFR-07: Observability

The production system should provide:

* Application logs
* Error logs
* API request logging
* WebSocket connection logging
* Call failure logging

Future improvement:

* Metrics
* Tracing
* Centralized logging

---

## NFR-08: Usability

The application should:

* Provide meaningful error messages.
* Show loading states.
* Show connection status.
* Prevent accidental duplicate actions.
* Clearly indicate active calls.
* Clearly indicate incoming calls.

---

## NFR-09: Accessibility

The frontend should follow basic accessibility practices:

* Keyboard navigation
* Labels for inputs
* Accessible buttons
* Appropriate focus states
* Sufficient contrast
* Meaningful error messages

---

## NFR-10: Browser Compatibility

The MVP will target modern browsers.

Primary development/testing browsers:

* Chrome
* Edge
* Firefox

Safari compatibility can be validated during the hardening phase.

---

# 6. System Architecture

Initial architecture:

```text
                       ┌─────────────────────┐
                       │      Angular        │
                       │      Frontend       │
                       │    Port: 4200       │
                       └──────────┬──────────┘
                                  │
                           HTTP / REST
                                  │
                                  ▼
                       ┌─────────────────────┐
                       │      Django         │
                       │       DRF           │
                       │    Port: 8000       │
                       └──────────┬──────────┘
                                  │
                                  ▼
                            PostgreSQL
```

Real-time architecture:

```text
Angular
   │
   │ WebSocket
   ▼
Django Channels
   │
   ▼
Redis
   │
   ├─────────────┐
   ▼             ▼
Client A       Client B
```

Calling architecture:

```text
              Signaling
Client A ─────────────────── Client B
   │                             │
   │                             │
   └──────── WebRTC ─────────────┘
          Audio / Video
```

Django/Channels will be responsible for signaling.

WebRTC will be responsible for the actual media connection.

---

# 7. Technology Stack

## Frontend

* Angular
* TypeScript
* SCSS
* RxJS
* Angular Router

## Backend

* Python
* Django
* Django REST Framework
* Django Channels

## Database

* PostgreSQL

## Real-Time Infrastructure

* WebSockets
* Redis

## Calling

* WebRTC

## Authentication

* JWT

## Development / DevOps

* Git
* GitHub
* Docker
* Docker Compose
* GitHub Actions

---

# 8. Django Application Structure

The Django project is named `commute`.

Initial structure:

```text
backend/
│
├── manage.py
│
└── commute/
    ├── settings.py
    ├── urls.py
    ├── asgi.py
    └── wsgi.py
```

Business applications will be added later:

```text
backend/
│
├── commute/
│
├── users/
│
├── chat/
│
├── calls/
│
└── ...
```

## Django Apps

### users

Responsible for:

* Registration
* Authentication
* JWT
* User profiles
* User discovery
* Presence-related user information

### chat

Responsible for:

* Conversations
* Messages
* Message history
* WebSocket chat
* Notifications
* Typing indicators
* Read receipts

### calls

Responsible for:

* Call creation
* Call state
* Call history
* WebRTC signaling

---

# 9. API Requirements

Initial API conventions:

```text
/api/auth/
/api/users/
/api/chat/
/api/calls/
```

Example endpoints:

```text
POST   /api/auth/register/
POST   /api/auth/login/
POST   /api/auth/logout/

GET    /api/users/
GET    /api/users/me/

GET    /api/chat/conversations/
POST   /api/chat/conversations/

GET    /api/chat/conversations/{id}/messages/
POST   /api/chat/conversations/{id}/messages/

POST   /api/calls/
GET    /api/calls/history/
```

These endpoints will be implemented incrementally.

---

# 10. WebSocket Requirements

Initial WebSocket route:

```text
/ws/chat/{conversation_id}/
```

Future routes may include:

```text
/ws/presence/
/ws/calls/
```

Example chat events:

```json
{
  "type": "message",
  "conversation_id": 1,
  "content": "Hello"
}
```

Example server event:

```json
{
  "type": "message",
  "message_id": 42,
  "sender": {
    "id": 1,
    "name": "Ajay"
  },
  "content": "Hello",
  "created_at": "2026-10-06T10:00:00Z"
}
```

---

# 11. WebRTC Requirements

The MVP will use WebRTC for:

* Audio
* Video

The signaling layer will use WebSockets.

Signaling messages will exchange information such as:

* SDP offer
* SDP answer
* ICE candidates
* Call state

The actual audio/video media will not be stored by Django for the basic MVP.

---

# 12. Data Model — Initial Version

## User

```text
User
----
id
email
password
name
profile_image
created_at
updated_at
last_seen
```

## Conversation

```text
Conversation
------------
id
created_at
updated_at
```

## ConversationParticipant

```text
ConversationParticipant
-----------------------
id
conversation_id
user_id
joined_at
```

## Message

```text
Message
-------
id
conversation_id
sender_id
content
created_at
updated_at
```

## Call

```text
Call
----
id
caller_id
recipient_id
call_type
status
started_at
ended_at
duration
created_at
```

The exact database schema may evolve during implementation.

---

# 13. GitHub Issue / Ticket Backlog

Use the following tickets as GitHub Issues.

Priority:

* P0 = Must have
* P1 = Important
* P2 = Nice to have

---

## EPIC 1 — Project Setup

### RTC-001 — Initialize repository

**Priority:** P0

Tasks:

* Create Git repository
* Create README
* Create `.gitignore`
* Create frontend directory
* Create backend directory

---

### RTC-002 — Setup Angular application

**Priority:** P0

Tasks:

* Create Angular project
* Configure routing
* Configure SCSS
* Verify local development server
* Create initial application layout

---

### RTC-003 — Setup Django application

**Priority:** P0

Tasks:

* Create Python virtual environment
* Install Django
* Create `commute` Django project
* Configure development settings
* Run initial migrations
* Verify Django development server

---

### RTC-004 — Create development documentation

**Priority:** P1

Tasks:

* Document setup commands
* Document Node/Python versions
* Document frontend startup
* Document backend startup

---

# EPIC 2 — Frontend ↔ Backend

### RTC-005 — Create Django REST API structure

**Priority:** P0

Tasks:

* Install Django REST Framework
* Configure `INSTALLED_APPS`
* Create API URL namespace
* Create initial API endpoint

---

### RTC-006 — Create health-check API

**Priority:** P0

Endpoint:

```text
GET /api/health/
```

Expected response:

```json
{
  "status": "ok"
}
```

---

### RTC-007 — Connect Angular to Django health API

**Priority:** P0

Tasks:

* Configure Angular HTTP client
* Create API service
* Call `/api/health/`
* Display backend status in UI

Acceptance criteria:

```text
Angular → Django → JSON response → Angular UI
```

---

### RTC-008 — Configure CORS

**Priority:** P0

Tasks:

* Configure backend CORS
* Allow local Angular development origin
* Verify browser request succeeds

---

# EPIC 3 — Authentication

### RTC-009 — Create users app

**Priority:** P0

Tasks:

* Create Django `users` app
* Configure user model
* Configure migrations

---

### RTC-010 — User registration API

**Priority:** P0

Endpoint:

```text
POST /api/auth/register/
```

---

### RTC-011 — JWT login

**Priority:** P0

Tasks:

* Add JWT authentication
* Create login endpoint
* Return access token
* Return refresh token
* Protect authenticated endpoints

---

### RTC-012 — Angular authentication service

**Priority:** P0

Tasks:

* Login page
* Registration page
* Authentication service
* Token handling
* Logout
* Route protection

---

### RTC-013 — Authentication error handling

**Priority:** P1

Tasks:

* Invalid credentials
* Expired token
* Unauthorized API responses
* Session expiry handling

---

# EPIC 4 — Users & Presence

### RTC-014 — User profile API

**Priority:** P0

Tasks:

* Current user endpoint
* Update profile
* User serialization

---

### RTC-015 — User list API

**Priority:** P0

Tasks:

* List users
* Exclude current user
* Add pagination if required

---

### RTC-016 — Online/offline presence

**Priority:** P0

Tasks:

* Track WebSocket connection
* Update online status
* Update last-seen time
* Broadcast presence changes

---

# EPIC 5 — Chat

### RTC-017 — Create chat app

**Priority:** P0

Tasks:

* Create Django `chat` app
* Create conversation model
* Create participant model
* Create message model

---

### RTC-018 — Conversation API

**Priority:** P0

Tasks:

* Create conversation
* List conversations
* Retrieve conversation
* Prevent duplicate one-to-one conversations

---

### RTC-019 — Message history API

**Priority:** P0

Tasks:

* Retrieve conversation messages
* Add pagination
* Enforce conversation permissions

---

### RTC-020 — Angular chat UI

**Priority:** P0

Tasks:

* Conversation list
* Chat window
* Message input
* Message bubbles
* Loading states
* Error states

---

### RTC-021 — WebSocket chat

**Priority:** P0

Tasks:

* Install/configure Django Channels
* Create chat consumer
* Create WebSocket routing
* Connect Angular WebSocket client
* Broadcast messages
* Persist messages

Acceptance criteria:

Two browser windows logged in as different users can exchange messages without refreshing.

---

### RTC-022 — Unread messages

**Priority:** P1

Tasks:

* Track unread messages
* Display unread count
* Mark messages/conversations as read

---

### RTC-023 — Typing indicator

**Priority:** P2

Tasks:

* Send typing event
* Display typing indicator
* Automatically clear indicator

---

# EPIC 6 — Calling

### RTC-024 — Create calls app

**Priority:** P0

Tasks:

* Create `calls` Django app
* Create call model
* Define call states

---

### RTC-025 — Call signaling WebSocket

**Priority:** P0

Support:

* Offer
* Answer
* ICE candidate
* Accept
* Reject
* End

---

### RTC-026 — Angular WebRTC service

**Priority:** P0

Tasks:

* Request microphone permission
* Request camera permission
* Create `RTCPeerConnection`
* Handle local stream
* Handle remote stream

---

### RTC-027 — Incoming call UI

**Priority:** P0

Tasks:

* Incoming call dialog
* Caller information
* Accept button
* Reject button

---

### RTC-028 — Audio/video call UI

**Priority:** P0

Tasks:

* Local video
* Remote video
* Mute/unmute
* Camera on/off
* End call

---

### RTC-029 — Call history

**Priority:** P1

Tasks:

* Save call records
* Display call history
* Display call duration
* Display call status

---

# EPIC 7 — Redis & Scalability

### RTC-030 — Add Redis locally

**Priority:** P1

Tasks:

* Add Redis to local environment
* Configure Django Channels Redis layer
* Verify multiple connections

---

### RTC-031 — Test multi-instance WebSocket communication

**Priority:** P2

Tasks:

* Run multiple backend instances
* Use shared Redis channel layer
* Verify cross-instance message delivery

---

# EPIC 8 — Security

### RTC-032 — Backend authorization

**Priority:** P0

Tasks:

* Protect API endpoints
* Protect conversation access
* Protect call access
* Validate resource ownership

---

### RTC-033 — Secure configuration

**Priority:** P0

Tasks:

* Move secrets to environment variables
* Create `.env.example`
* Ensure `.env` is ignored
* Remove credentials from source control

---

### RTC-034 — Production security settings

**Priority:** P1

Tasks:

* HTTPS
* Secure cookies where applicable
* Secure WebSocket
* Allowed hosts
* CORS restrictions
* Security headers

---

# EPIC 9 — Testing

### RTC-035 — Backend unit tests

**Priority:** P1

Test:

* Registration
* Login
* Authentication
* Authorization
* Conversations
* Messages

---

### RTC-036 — WebSocket tests

**Priority:** P1

Test:

* Connection
* Authentication
* Message delivery
* Disconnect
* Authorization

---

### RTC-037 — Frontend tests

**Priority:** P1

Test:

* Login
* Registration
* Chat
* Services
* Error handling

---

### RTC-038 — End-to-end tests

**Priority:** P1

Test:

```text
Register
   ↓
Login
   ↓
Find user
   ↓
Start conversation
   ↓
Send message
   ↓
Receive message
   ↓
Start call
   ↓
End call
```

---

# EPIC 10 — Deployment

### RTC-039 — Dockerize backend

**Priority:** P1

---

### RTC-040 — Dockerize frontend

**Priority:** P1

---

### RTC-041 — Docker Compose development environment

**Priority:** P1

Services:

```text
frontend
backend
postgres
redis
```

---

### RTC-042 — CI pipeline

**Priority:** P1

GitHub Actions should:

* Install dependencies
* Run linting
* Run tests
* Build Angular
* Validate Django

---

### RTC-043 — Production deployment

**Priority:** P1

Deploy:

* Angular
* Django
* PostgreSQL
* Redis

Configure:

* HTTPS
* Domain
* Environment variables
* Production logging

---

# 14. Suggested Sprint Plan

Because this is a solo project and you also want to continue DSA, we should avoid enormous sprints.

## Sprint 0 — Foundation

Goal:

```text
Get the project running.
```

Tickets:

```text
RTC-001
RTC-002
RTC-003
RTC-004
```

Definition of Done:

```text
Angular runs locally.
Django runs locally.
Git repository is cleanly structured.
README is documented.
```

---

# Sprint 1 — Frontend ↔ Backend

Tickets:

```text
RTC-005
RTC-006
RTC-007
RTC-008
```

Goal:

```text
Angular → HTTP → Django → JSON → Angular
```

This is our first complete vertical slice.

---

# Sprint 2 — Authentication

Tickets:

```text
RTC-009
RTC-010
RTC-011
RTC-012
RTC-013
```

Goal:

```text
Register
Login
Logout
JWT
Protected routes
```

---

# Sprint 3 — Users & Conversations

Tickets:

```text
RTC-014
RTC-015
RTC-017
RTC-018
RTC-019
RTC-020
```

Goal:

```text
User
  ↓
Find another user
  ↓
Start conversation
  ↓
Open chat
  ↓
View history
```

---

# Sprint 4 — Real-Time Messaging

Tickets:

```text
RTC-021
RTC-022
RTC-023
```

Goal:

```text
Browser A
    ↓
WebSocket
    ↓
Django Channels
    ↓
Browser B
```

This sprint is particularly important because it introduces the real-time architecture.

---

# Sprint 5 — WebRTC Calling

Tickets:

```text
RTC-024
RTC-025
RTC-026
RTC-027
RTC-028
RTC-029
```

Goal:

```text
User A
   ↕
Signaling Server
   ↕
User B

       ↓

WebRTC
Audio / Video
```

---

# Sprint 6 — Redis & Production Hardening

Tickets:

```text
RTC-030
RTC-031
RTC-032
RTC-033
RTC-034
```

---

# Sprint 7 — Testing

Tickets:

```text
RTC-035
RTC-036
RTC-037
RTC-038
```

---

# Sprint 8 — Deployment

Tickets:

```text
RTC-039
RTC-040
RTC-041
RTC-042
RTC-043
```

---

# 15. Definition of Done

A ticket is considered complete only when:

* Code is implemented.
* Relevant tests are added/updated.
* Code is locally verified.
* No obvious console/runtime errors remain.
* Documentation is updated when necessary.
* A Git branch was created for the ticket.
* A Pull Request is opened.
* PR is reviewed/self-reviewed.
* PR is merged into the main development branch.

---

# 16. Git Branch Convention

Use:

```text
feature/RTC-001-project-setup
feature/RTC-007-angular-django-connection
feature/RTC-011-jwt-login
feature/RTC-021-websocket-chat
feature/RTC-026-webrtc-service
bugfix/RTC-013-token-expiry
```

---

# 17. Commit Convention

Recommended format:

```text
feat: add Django health check API
feat: implement JWT login
feat: add conversation model
feat: implement websocket chat
fix: handle expired access token
test: add conversation authorization tests
refactor: extract chat service
docs: update local development setup
```

---

# 18. Pull Request Template

Every PR should answer:

### What changed?

Describe the implementation.

### Why?

Explain the requirement/ticket.

### How?

Explain the important technical decisions.

### Testing

Mention:

* Unit tests
* Manual testing
* Browser testing

### Ticket

```text
Closes RTC-XXX
```

---

# 19. GitHub Project Board

Create a GitHub Project with these columns:

```text
Backlog
   ↓
Ready
   ↓
In Progress
   ↓
Code Review
   ↓
Testing
   ↓
Done
```

Suggested labels:

```text
frontend
backend
database
websocket
webrtc
security
testing
devops
bug
documentation
P0
P1
P2
```

---

# 20. Project Milestones

## Milestone 1 — Foundation

```text
Angular
Django
Git
Basic REST communication
```

## Milestone 2 — Authentication

```text
Registration
Login
JWT
Authorization
```

## Milestone 3 — Messaging

```text
Users
Conversations
Messages
WebSockets
```

## Milestone 4 — Calling

```text
Signaling
WebRTC
Audio
Video
Call states
```

## Milestone 5 — Production

```text
Redis
Docker
Testing
CI/CD
Deployment
Security
```

---

# 21. DSA + Project Study Plan

The purpose of this project is not to replace DSA preparation.

Both should progress together.

Recommended weekly split:

```text
Project Development
-------------------
5 days × 1.5–2 hours

DSA
---
5 days × 1–1.5 hours

Weekend
-------
Project: 2–3 hours
DSA:     2–3 hours
```

A typical weekday:

```text
60–90 min  → Project
60 min     → DSA
```

Project time should be focused on completing one ticket rather than randomly coding.

DSA time should remain focused on your interview roadmap.

---

# 22. DSA Tracking

Maintain a separate GitHub Project or spreadsheet for DSA.

Suggested categories:

```text
Arrays
Strings
Hashing
Two Pointers
Sliding Window
Binary Search
Linked List
Stack
Queue
Trees
BST
Heap
Graphs
Greedy
Backtracking
Dynamic Programming
```

For every problem track:

```text
Problem
Pattern
Difficulty
First Attempt
Solved?
Optimal Solution
Time Complexity
Space Complexity
Mistake
Revisited?
```

---

# 23. Engineering Principles

Throughout this project we will prioritize:

### Understand before implementing

Do not blindly copy code.

Before implementing a feature, understand:

```text
Problem
↓
Requirements
↓
Design
↓
Implementation
↓
Testing
```

### Small vertical slices

Instead of building all frontend code first and all backend code later, prefer:

```text
Database
↓
Backend API
↓
Frontend service
↓
Frontend UI
↓
Testing
```

### One feature at a time

Example:

```text
Login
```

should become:

```text
DB
↓
Django API
↓
JWT
↓
Angular service
↓
Login UI
↓
Route guard
↓
Tests
```

rather than creating the complete UI first.

---

# 24. MVP Success Criteria

The MVP is complete when two users can:

```text
1. Register
        ↓
2. Login
        ↓
3. See each other
        ↓
4. Start a conversation
        ↓
5. Exchange messages in real time
        ↓
6. See online/offline status
        ↓
7. Start an audio/video call
        ↓
8. Accept/reject the call
        ↓
9. End the call
        ↓
10. View call history
```

All of this should work with:

```text
Angular
    +
Django REST Framework
    +
Django Channels
    +
PostgreSQL
    +
Redis
    +
WebRTC
```

---

# 25. Current Status

## Sprint 0

| Ticket  | Status      |
| ------- | ----------- |
| RTC-001 | In Progress |
| RTC-002 | ✅ Done      |
| RTC-003 | In Progress |
| RTC-004 | Pending     |

Current environment:

```text
Angular 21
Node.js 24
Python 3.11
Django 5.2
Git
```

Current URLs:

```text
Frontend:
http://localhost:4200

Backend:
http://127.0.0.1:8000
```

---

# 26. Immediate Next Task

The next development task is:

**RTC-005 — Create Django REST API structure**

Then:

**RTC-006 — Create health-check API**

Then:

**RTC-007 — Connect Angular to Django**

The first successful end-to-end request should be:

```text
Angular
   │
   │ GET /api/health/
   ▼
Django
   │
   │ JSON
   ▼
Angular UI

{
  "status": "ok"
}
```

This will be the first complete vertical slice of the project.
