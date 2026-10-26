# Frontend Architecture & Guide — Real-Time Communication Platform

The frontend is a single-page application built with **Angular 21** using **Standalone Components**, modern **Angular Signals** for reactive state management, **RxJS**, and browser-native **WebRTC** APIs for peer-to-peer real-time audio and video communications.

---

## 1. Technology Stack

* **Framework:** Angular 21 (Standalone Components)
* **Reactive State:** Angular Signals (`signal`, `computed`, `effect`)
* **Styling:** Modular SCSS & Glassmorphism design system
* **Real-Time Messaging:** Native Browser WebSockets
* **P2P Audio/Video:** WebRTC (`RTCPeerConnection`, `getUserMedia`, `MediaStream`)
* **Testing:** Vitest (`@angular/build`) with unit & component test coverage

---

## 2. Directory Structure

```text
frontend/src/app/
├── app.ts                          # Root component with layout and header
├── app.html                        # Main template outlet & global toast
├── app.routes.ts                   # Angular route configuration
├── app.config.ts                   # Application providers, interceptors, routing
│
├── core/                           # Singleton services, models, guards, interceptors
│   ├── guards/
│   │   ├── auth.guard.ts           # Protects private routes (/chat, /profile)
│   │   └── public.guard.ts         # Prevents authenticated users from seeing /login
│   ├── interceptors/
│   │   ├── jwt.interceptor.ts      # Attaches Authorization: Bearer <token>
│   │   └── error.interceptor.ts    # Intercepts 401s, triggers auto token refresh
│   ├── models/
│   │   ├── auth.model.ts           # Token and AuthPayload interfaces
│   │   ├── user.model.ts           # User interface
│   │   ├── chat.model.ts           # Conversation, Message, Typing interfaces
│   │   └── call.model.ts           # CallRecord, ActiveCall, CallUiState interfaces
│   └── services/
│       ├── auth.service.ts         # Authentication, token lifecycle, current user
│       ├── user.service.ts         # User profiles and user directory discovery
│       ├── chat.service.ts         # Conversations, messages, chat WebSocket
│       ├── presence.service.ts     # User online/offline presence WebSocket
│       ├── webrtc.service.ts       # WebRTC peer connection, signaling, media streams
│       ├── call.service.ts         # REST API service for call history records
│       ├── alert.service.ts        # Toast and banner notification service
│       └── health.service.ts       # Backend health check monitoring
│
└── features/                       # Feature modules (views and subcomponents)
    ├── auth/
    │   ├── login/                  # User login view with reactive forms
    │   └── register/               # User registration view with validation
    ├── profile/
    │   └── profile.component.ts    # User profile view and update card
    └── chat/
        ├── chat.component.ts       # Master dashboard & modal orchestrator
        └── components/
            ├── conversation-list/  # Conversation cards with unread badges & call buttons
            ├── message-window/     # Message stream with bubble layout & call headers
            ├── message-input/      # Text message input with Enter-to-send
            ├── incoming-call-modal/# Incoming audio/video call modal with pulse rings
            ├── active-call-overlay/# Glassmorphic active audio & video call grid with PiP
            └── call-history-modal/ # Log of completed, missed, and declined calls
```

---

## 3. WebRTC Calling Architecture

### State Management via Signals
* `callState`: `'idle' | 'calling' | 'ringing' | 'connected' | 'ended'`
* `currentCall`: Contains call ID, partner details, and `call_type` (`'audio' | 'video'`).
* `localStream`: User's captured microphone and camera `MediaStream`.
* `remoteStream`: Aggregated `MediaStream` containing peer audio and video tracks.
* `isAudioMuted` & `isVideoMuted`: Local mute toggles.
* `isRemoteVideoMuted`: Reactively updates when the remote peer turns off their camera.
* `hasMultipleVideoDevices`: Discovers front and back camera availability for mobile flip.

### Active Call Overlay (`ActiveCallOverlayComponent`)
1. **Audio Call Mode:** Displays a centered profile visual with an animated equalizer wave, duration timer, mic mute toggle, camera upgrade button, and end call button.
2. **Video Call Mode:** Displays:
   * **Main Stage (Remote Video):** Full viewport feed with aspect ratio preservation and automatic avatar placeholder if peer camera is turned off.
   * **Picture-in-Picture (Local Video):** Inset floating selfie feed with mirrored preview and camera-off indicator. Click-to-swap views supported.
   * **Floating Glass Controls:** Mic mute, Camera mute, Flip camera (if available), Fullscreen toggle, and End Call.
   * **Dynamic Media Renegotiation:** Users can upgrade an ongoing audio call to video mid-session using `upgradeToVideo()`.

---

## 4. How to Run the Frontend

```bash
# 1. Install dependencies (if not already done)
npm install

# 2. Start Angular Development Server
npm start
# (Runs: ng serve --host 0.0.0.0 --port 4200)
```

Open [http://localhost:4200](http://localhost:4200) in your browser.

---

## 5. Running Frontend Tests

To run the Vitest test suite in single-run mode:

```bash
npm test -- --watch=false
```
