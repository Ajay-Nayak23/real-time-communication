import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
  computed,
  signal,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CallType, CallUiState } from '../../../../core/models/call.model';

@Component({
  selector: 'app-active-call-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      #overlayContainer
      class="active-call-container"
      [class.video-mode]="callType === 'video'"
      [class.connected]="callState === 'connected'"
      role="region"
      aria-label="Active Call Session"
    >
      <!-- Hidden audio element for receiving peer audio stream -->
      <audio #remoteAudio autoplay playsinline></audio>

      <!-- ================= AUDIO CALL VIEW ================= -->
      @if (callType === 'audio') {
        <div class="call-card audio-card">
          <!-- Partner Profile -->
          <div class="partner-visual">
            @if (partnerAvatar) {
              <img [src]="partnerAvatar" [alt]="partnerName" class="partner-avatar-img" />
            } @else {
              <div class="partner-avatar-fallback">
                {{ getInitials(partnerName) }}
              </div>
            }

            @if (callState === 'connected') {
              <div class="visualizer-wave">
                <span class="bar bar-1"></span>
                <span class="bar bar-2"></span>
                <span class="bar bar-3"></span>
                <span class="bar bar-4"></span>
                <span class="bar bar-5"></span>
              </div>
            }
          </div>

          <div class="partner-meta">
            <h2 class="partner-name">{{ partnerName }}</h2>

            @if (callState === 'calling') {
              <div class="calling-indicator">
                <span class="calling-dot"></span>
                <span class="calling-dot"></span>
                <span class="calling-dot"></span>
                <span class="calling-text">Calling...</span>
              </div>
            } @else if (callState === 'connected') {
              <div class="connected-badge">
                <span class="connected-dot"></span>
                <span class="timer-text">{{ formattedDuration() }}</span>
              </div>
            }
          </div>

          <!-- Audio Call Controls Toolbar -->
          <div class="call-controls">
            <!-- Mic Mute Toggle -->
            <button
              type="button"
              class="control-btn btn-mute"
              [class.muted]="isAudioMuted"
              (click)="toggleMute.emit()"
              [title]="isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'"
              aria-label="Toggle Microphone"
            >
              @if (isAudioMuted) {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              } @else {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              }
            </button>

            <!-- Turn on Video (Upgrade to Video Call) -->
            <button
              type="button"
              class="control-btn btn-camera"
              (click)="upgradeToVideo.emit()"
              title="Turn On Camera"
              aria-label="Turn On Camera"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="23 7 16 12 23 17 23 7"></polygon>
                <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
              </svg>
            </button>

            <!-- End Call -->
            <button
              type="button"
              class="control-btn btn-end-call"
              (click)="endCall.emit()"
              title="End Call"
              aria-label="End Call"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                <line x1="23" y1="1" x2="1" y2="23"></line>
              </svg>
            </button>
          </div>
        </div>
      }

      <!-- ================= VIDEO CALL VIEW ================= -->
      @if (callType === 'video') {
        <div class="video-grid-wrapper">
          <!-- Top Floating Metadata Bar -->
          <div class="video-top-bar">
            <div class="video-partner-info">
              <span class="live-dot" [class.pulse]="callState === 'connected'"></span>
              <span class="video-partner-name">{{ partnerName }}</span>
              @if (callState === 'connected') {
                <span class="video-timer-badge">{{ formattedDuration() }}</span>
              } @else {
                <span class="video-status-badge">Connecting...</span>
              }
            </div>

            <div class="video-top-actions">
              <button
                type="button"
                class="icon-action-btn"
                (click)="toggleFullscreen()"
                [title]="isFullscreen() ? 'Exit Fullscreen' : 'Fullscreen'"
                aria-label="Toggle Fullscreen"
              >
                @if (isFullscreen()) {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="4 14 10 14 10 20"></polyline>
                    <polyline points="20 10 14 10 14 4"></polyline>
                    <line x1="14" y1="10" x2="21" y2="3"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                } @else {
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <polyline points="9 21 3 21 3 15"></polyline>
                    <line x1="21" y1="3" x2="14" y2="10"></line>
                    <line x1="3" y1="21" x2="10" y2="14"></line>
                  </svg>
                }
              </button>
            </div>
          </div>

          <!-- Main Stream Area (Remote Video Feed) -->
          <div class="main-video-stage">
            <video
              #remoteVideo
              class="remote-video-element"
              [class.hidden-video]="isRemoteVideoMuted || !hasRemoteVideoTrack()"
              autoplay
              playsinline
            ></video>

            <!-- Remote Video Placeholder (Camera off / Ringing) -->
            @if (isRemoteVideoMuted || !hasRemoteVideoTrack()) {
              <div class="remote-video-fallback">
                <div class="fallback-avatar-wrap">
                  @if (partnerAvatar) {
                    <img [src]="partnerAvatar" [alt]="partnerName" class="fallback-avatar-img" />
                  } @else {
                    <div class="fallback-avatar-initials">
                      {{ getInitials(partnerName) }}
                    </div>
                  }
                  <div class="fallback-ripple"></div>
                </div>

                <div class="fallback-notice">
                  @if (callState === 'calling') {
                    <span class="fallback-badge">Calling {{ partnerName }}...</span>
                  } @else if (isRemoteVideoMuted) {
                    <span class="fallback-badge">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="1" y1="1" x2="23" y2="23"></line>
                        <path d="M21 21l-3.34-3.34L3 3l18 18z"></path>
                        <path d="m16 16-1.5-1.5M23 7l-7 5 7 5V7z"></path>
                        <rect width="14" height="12" x="2" y="6" rx="2"></rect>
                      </svg>
                      {{ partnerName }}'s camera is turned off
                    </span>
                  } @else {
                    <span class="fallback-badge">Waiting for video stream...</span>
                  }
                </div>
              </div>
            }

            <!-- Floating Picture-in-Picture Local Stream -->
            <div
              class="pip-local-wrapper"
              [class.pip-swapped]="isPipSwapped()"
              (click)="togglePipSwap()"
              title="Click to swap views"
            >
              <video
                #localVideo
                class="local-video-element"
                [class.hidden-video]="isVideoMuted"
                autoplay
                playsinline
                muted
              ></video>

              <!-- Local Camera Off Placeholder -->
              @if (isVideoMuted) {
                <div class="local-camera-off">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="1" y1="1" x2="23" y2="23"></line>
                    <path d="M21 21l-3.34-3.34L3 3l18 18z"></path>
                    <path d="m16 16-1.5-1.5M23 7l-7 5 7 5V7z"></path>
                    <rect width="14" height="12" x="2" y="6" rx="2"></rect>
                  </svg>
                  <span class="pip-off-label">Camera off</span>
                </div>
              }

              <!-- Local overlay badge -->
              <div class="pip-label">
                <span>You</span>
                @if (isAudioMuted) {
                  <span class="pip-mute-icon" title="Mic Muted">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <line x1="1" y1="1" x2="23" y2="23"></line>
                      <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                      <line x1="12" y1="19" x2="12" y2="23"></line>
                    </svg>
                  </span>
                }
              </div>
            </div>
          </div>

          <!-- Bottom Floating Controls Overlay -->
          <div class="video-bottom-controls">
            <!-- Audio Mute Toggle -->
            <button
              type="button"
              class="control-btn btn-mute"
              [class.muted]="isAudioMuted"
              (click)="toggleMute.emit()"
              [title]="isAudioMuted ? 'Unmute Microphone' : 'Mute Microphone'"
              aria-label="Toggle Microphone"
            >
              @if (isAudioMuted) {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                  <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              } @else {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                  <line x1="12" y1="19" x2="12" y2="23"></line>
                  <line x1="8" y1="23" x2="16" y2="23"></line>
                </svg>
              }
            </button>

            <!-- Video Camera Toggle -->
            <button
              type="button"
              class="control-btn btn-camera"
              [class.muted]="isVideoMuted"
              (click)="toggleVideo.emit()"
              [title]="isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'"
              aria-label="Toggle Camera"
            >
              @if (isVideoMuted) {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                  <path d="M21 21l-3.34-3.34L3 3l18 18z"></path>
                  <path d="m16 16-1.5-1.5M23 7l-7 5 7 5V7z"></path>
                  <rect width="14" height="12" x="2" y="6" rx="2"></rect>
                </svg>
              } @else {
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="23 7 16 12 23 17 23 7"></polygon>
                  <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                </svg>
              }
            </button>

            <!-- Switch Camera (Front/Back) -->
            @if (canSwitchCamera) {
              <button
                type="button"
                class="control-btn btn-switch"
                (click)="switchCamera.emit()"
                title="Switch Camera"
                aria-label="Switch Camera"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 10c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.21 1 4 2.5 5.5L4 18h6v-6l-2.2 2.2C6.7 13 6 11.6 6 10c0-3.314 2.686-6 6-6s6 2.686 6 6-2.686 6-6 6c-1.3 0-2.5-.4-3.5-1.2l-1.5 1.5C8.4 17.3 10.1 18 12 18c4.418 0 8-3.582 8-8z"></path>
                </svg>
              </button>
            }

            <!-- End Video Call -->
            <button
              type="button"
              class="control-btn btn-end-call"
              (click)="endCall.emit()"
              title="End Call"
              aria-label="End Call"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
                <line x1="23" y1="1" x2="1" y2="23"></line>
              </svg>
            </button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .active-call-container {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at 50% 30%, rgba(30, 58, 138, 0.45) 0%, rgba(15, 23, 42, 0.96) 100%);
      backdrop-filter: blur(24px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1500;
      padding: 1.5rem;
      animation: fadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      overflow: hidden;

      &.video-mode {
        padding: 0;
        background: #090d16;
      }
    }

    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.98); }
      to { opacity: 1; transform: scale(1); }
    }

    /* --- AUDIO CALL STYLES --- */
    .audio-card {
      background: rgba(30, 41, 59, 0.72);
      backdrop-filter: blur(28px);
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-radius: 28px;
      padding: 3rem 2.5rem;
      max-width: 440px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.65), 0 0 50px rgba(59, 130, 246, 0.2);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .partner-visual {
      position: relative;
      width: 110px;
      height: 110px;
      margin-bottom: 1.5rem;
    }

    .partner-avatar-img {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(59, 130, 246, 0.4);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .partner-avatar-fallback {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.25rem;
      font-weight: 700;
      color: #ffffff;
      border: 3px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }

    .visualizer-wave {
      position: absolute;
      bottom: -10px;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: 3px;
      padding: 4px 8px;
      background: rgba(15, 23, 42, 0.85);
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .bar {
      width: 3px;
      background: #60a5fa;
      border-radius: 3px;
      animation: equalizer 1.2s infinite ease-in-out;
    }

    .bar-1 { height: 8px; animation-delay: 0.1s; }
    .bar-2 { height: 16px; animation-delay: 0.3s; }
    .bar-3 { height: 22px; animation-delay: 0.2s; }
    .bar-4 { height: 14px; animation-delay: 0.4s; }
    .bar-5 { height: 9px; animation-delay: 0.15s; }

    @keyframes equalizer {
      0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
      50% { transform: scaleY(1.2); opacity: 1; }
    }

    .partner-meta {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 2.5rem;
    }

    .partner-name {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.02em;
    }

    .calling-indicator {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      color: #94a3b8;
      font-size: 0.95rem;
    }

    .calling-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #60a5fa;
      animation: callingPulse 1.4s infinite ease-in-out;
    }

    .calling-dot:nth-child(2) { animation-delay: 0.2s; }
    .calling-dot:nth-child(3) { animation-delay: 0.4s; }

    @keyframes callingPulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1.2); opacity: 1; }
    }

    .calling-text {
      margin-left: 4px;
    }

    .connected-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.95rem;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      border-radius: 999px;
    }

    .connected-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: statusPulse 2s infinite;
    }

    @keyframes statusPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }

    .timer-text {
      color: #6ee7b7;
      font-family: monospace;
      font-size: 0.95rem;
      font-weight: 600;
      letter-spacing: 1px;
    }

    /* --- VIDEO CALL LAYOUT & GRIDS --- */
    .video-grid-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: #090d16;
    }

    .video-top-bar {
      position: absolute;
      top: 1.25rem;
      left: 1.5rem;
      right: 1.5rem;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 20;
      pointer-events: none;
    }

    .video-partner-info {
      pointer-events: auto;
      display: inline-flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      padding: 0.45rem 1rem 0.45rem 0.85rem;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }

    .live-dot {
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 8px #10b981;

      &.pulse {
        animation: statusPulse 2s infinite;
      }
    }

    .video-partner-name {
      color: #f8fafc;
      font-size: 0.95rem;
      font-weight: 600;
    }

    .video-timer-badge {
      font-family: monospace;
      font-size: 0.85rem;
      color: #6ee7b7;
      background: rgba(16, 185, 129, 0.15);
      padding: 2px 8px;
      border-radius: 999px;
    }

    .video-status-badge {
      font-size: 0.85rem;
      color: #94a3b8;
    }

    .video-top-actions {
      pointer-events: auto;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .icon-action-btn {
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 50%;
      width: 42px;
      height: 42px;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #e2e8f0;
      cursor: pointer;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(255, 255, 255, 0.15);
        color: #ffffff;
        transform: scale(1.05);
      }
    }

    /* Main Video Stage */
    .main-video-stage {
      position: relative;
      flex: 1;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background: radial-gradient(circle at 50% 50%, #1e293b 0%, #090d16 100%);
      overflow: hidden;
    }

    .remote-video-element {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transition: opacity 0.3s ease;

      &.hidden-video {
        opacity: 0;
        pointer-events: none;
      }
    }

    .remote-video-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      z-index: 5;
    }

    .fallback-avatar-wrap {
      position: relative;
      width: 130px;
      height: 130px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .fallback-avatar-img,
    .fallback-avatar-initials {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      object-fit: cover;
      border: 3px solid rgba(59, 130, 246, 0.5);
      box-shadow: 0 12px 35px rgba(0, 0, 0, 0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #2563eb, #4f46e5);
      color: #ffffff;
      font-size: 2.75rem;
      font-weight: 700;
      z-index: 2;
    }

    .fallback-ripple {
      position: absolute;
      inset: -12px;
      border-radius: 50%;
      border: 2px solid rgba(59, 130, 246, 0.3);
      animation: rippleEffect 2s infinite ease-out;
    }

    @keyframes rippleEffect {
      0% { transform: scale(0.9); opacity: 0.8; }
      100% { transform: scale(1.3); opacity: 0; }
    }

    .fallback-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 1.25rem;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      color: #94a3b8;
      font-size: 0.95rem;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.35);
    }

    /* Picture-in-Picture Local Stream Container */
    .pip-local-wrapper {
      position: absolute;
      bottom: 6rem;
      right: 1.5rem;
      width: 220px;
      height: 140px;
      border-radius: 18px;
      overflow: hidden;
      background: #0f172a;
      border: 2px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 0, 0, 0.4);
      z-index: 15;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);

      &:hover {
        transform: scale(1.04);
        border-color: rgba(59, 130, 246, 0.6);
        box-shadow: 0 20px 40px rgba(0, 0, 0, 0.7), 0 0 25px rgba(59, 130, 246, 0.3);
      }

      &.pip-swapped {
        top: 5rem;
        right: 1.5rem;
        bottom: auto;
      }
    }

    .local-video-element {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1); /* Mirror local selfie feed */

      &.hidden-video {
        opacity: 0;
        pointer-events: none;
      }
    }

    .local-camera-off {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.9);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      color: #94a3b8;
      font-size: 0.8rem;
    }

    .pip-label {
      position: absolute;
      bottom: 8px;
      left: 10px;
      right: 10px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 0.75rem;
      font-weight: 600;
      color: #ffffff;
      text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
      pointer-events: none;
    }

    .pip-mute-icon {
      color: #fca5a5;
      background: rgba(239, 68, 68, 0.4);
      border-radius: 50%;
      padding: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* Video Call Bottom Controls */
    .video-bottom-controls {
      position: absolute;
      bottom: 1.5rem;
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      z-index: 20;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 999px;
      padding: 0.75rem 1.75rem;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
    }

    /* Universal Control Buttons */
    .call-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      width: 100%;
    }

    .control-btn {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn-mute,
    .btn-camera,
    .btn-switch {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: #e2e8f0;

      &:hover {
        background: rgba(255, 255, 255, 0.2);
        transform: translateY(-2px);
      }

      &.muted {
        background: rgba(239, 68, 68, 0.25);
        border-color: rgba(239, 68, 68, 0.5);
        color: #fca5a5;

        &:hover {
          background: rgba(239, 68, 68, 0.35);
        }
      }
    }

    .btn-end-call {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 8px 24px rgba(239, 68, 68, 0.45);

      &:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 12px 30px rgba(239, 68, 68, 0.6);
      }

      &:active {
        transform: scale(0.96);
      }
    }

    /* Mobile / Tablet Responsive Adjustments */
    @media (max-width: 640px) {
      .pip-local-wrapper {
        bottom: 5.5rem;
        right: 1rem;
        width: 140px;
        height: 100px;
        border-radius: 12px;
      }

      .video-bottom-controls {
        bottom: 1rem;
        gap: 0.75rem;
        padding: 0.5rem 1rem;
      }

      .control-btn {
        width: 48px;
        height: 48px;
      }
    }
  `],
})
export class ActiveCallOverlayComponent implements OnInit, OnChanges, OnDestroy {
  private readonly platformId = inject(PLATFORM_ID);

  @Input() partnerName: string = 'Partner';
  @Input() partnerAvatar?: string | null = null;
  @Input() callState: CallUiState = 'calling';
  @Input() callType: CallType = 'audio';
  @Input() isAudioMuted: boolean = false;
  @Input() isVideoMuted: boolean = false;
  @Input() isRemoteVideoMuted: boolean = false;
  @Input() localStream: MediaStream | null = null;
  @Input() remoteStream: MediaStream | null = null;
  @Input() canSwitchCamera: boolean = false;

  @Output() toggleMute = new EventEmitter<void>();
  @Output() toggleVideo = new EventEmitter<void>();
  @Output() switchCamera = new EventEmitter<void>();
  @Output() upgradeToVideo = new EventEmitter<void>();
  @Output() endCall = new EventEmitter<void>();

  @ViewChild('remoteAudio') remoteAudioRef?: ElementRef<HTMLAudioElement>;
  @ViewChild('remoteVideo') remoteVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('localVideo') localVideoRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('overlayContainer') overlayContainerRef?: ElementRef<HTMLDivElement>;

  readonly durationSeconds = signal<number>(0);
  readonly isFullscreen = signal<boolean>(false);
  readonly isPipSwapped = signal<boolean>(false);

  readonly formattedDuration = computed(() => {
    const mins = Math.floor(this.durationSeconds() / 60);
    const secs = this.durationSeconds() % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  });

  private timerInterval: any = null;

  ngOnInit(): void {
    if (this.callState === 'connected') {
      this.startTimer();
    }
    setTimeout(() => this.attachStreams(), 50);
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['callState']) {
      if (this.callState === 'connected' && !this.timerInterval) {
        this.startTimer();
      } else if (this.callState !== 'connected' && this.timerInterval) {
        this.stopTimer();
      }
    }

    if (changes['remoteStream'] || changes['localStream'] || changes['callType']) {
      setTimeout(() => this.attachStreams(), 50);
    }
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  hasRemoteVideoTrack(): boolean {
    if (!this.remoteStream) return false;
    const tracks = this.remoteStream.getVideoTracks();
    return tracks.length > 0 && tracks.some((t) => t.readyState === 'live');
  }

  togglePipSwap(): void {
    this.isPipSwapped.update((val) => !val);
  }

  toggleFullscreen(): void {
    if (!isPlatformBrowser(this.platformId) || typeof document === 'undefined') {
      return;
    }

    if (!document.fullscreenElement) {
      if (this.overlayContainerRef?.nativeElement?.requestFullscreen) {
        this.overlayContainerRef.nativeElement
          .requestFullscreen()
          .then(() => this.isFullscreen.set(true))
          .catch(() => {});
      }
    } else {
      if (document.exitFullscreen) {
        document
          .exitFullscreen()
          .then(() => this.isFullscreen.set(false))
          .catch(() => {});
      }
    }
  }

  private startTimer(): void {
    this.durationSeconds.set(0);
    this.timerInterval = setInterval(() => {
      this.durationSeconds.update((s) => s + 1);
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private attachStreams(): void {
    // 1. Audio stream playback
    if (this.remoteAudioRef?.nativeElement && this.remoteStream) {
      try {
        if (this.remoteAudioRef.nativeElement.srcObject !== this.remoteStream) {
          this.remoteAudioRef.nativeElement.srcObject = this.remoteStream;
        }
        this.remoteAudioRef.nativeElement.play().catch(() => {});
      } catch {}
    }

    // 2. Video element for remote stream
    if (this.remoteVideoRef?.nativeElement && this.remoteStream) {
      try {
        if (this.remoteVideoRef.nativeElement.srcObject !== this.remoteStream) {
          this.remoteVideoRef.nativeElement.srcObject = this.remoteStream;
        }
        this.remoteVideoRef.nativeElement.play().catch(() => {});
      } catch {}
    }

    // 3. Local self-view stream
    if (this.localVideoRef?.nativeElement && this.localStream) {
      try {
        if (this.localVideoRef.nativeElement.srcObject !== this.localStream) {
          this.localVideoRef.nativeElement.srcObject = this.localStream;
        }
        this.localVideoRef.nativeElement.play().catch(() => {});
      } catch {}
    }
  }
}
