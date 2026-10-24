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
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallUiState } from '../../../../core/models/call.model';

@Component({
  selector: 'app-active-call-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="active-call-container" [class.connected]="callState === 'connected'">
      <!-- Hidden audio element for receiving peer audio stream -->
      <audio #remoteAudio autoplay playsinline></audio>

      <div class="call-card">
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

        <!-- Controls Toolbar -->
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
    </div>
  `,
  styles: [`
    .active-call-container {
      position: fixed;
      inset: 0;
      background: radial-gradient(circle at 50% 30%, rgba(30, 58, 138, 0.4) 0%, rgba(15, 23, 42, 0.95) 100%);
      backdrop-filter: blur(20px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1500;
      padding: 1.5rem;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .call-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 28px;
      padding: 3rem 2.5rem;
      max-width: 420px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.15);
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
      padding: 0.3rem 0.85rem;
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

    .call-controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      width: 100%;
    }

    .control-btn {
      width: 58px;
      height: 58px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn-mute {
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
      }
    }

    .btn-end-call {
      background: linear-gradient(135deg, #ef4444, #dc2626);
      box-shadow: 0 8px 20px rgba(239, 68, 68, 0.4);
      &:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 12px 26px rgba(239, 68, 68, 0.55);
      }
      &:active {
        transform: scale(0.96);
      }
    }
  `],
})
export class ActiveCallOverlayComponent implements OnInit, OnChanges, OnDestroy {
  @Input() partnerName: string = 'Partner';
  @Input() partnerAvatar?: string | null = null;
  @Input() callState: CallUiState = 'calling';
  @Input() isAudioMuted: boolean = false;
  @Input() remoteStream: MediaStream | null = null;

  @Output() toggleMute = new EventEmitter<void>();
  @Output() endCall = new EventEmitter<void>();

  @ViewChild('remoteAudio') remoteAudioRef?: ElementRef<HTMLAudioElement>;

  readonly durationSeconds = signal<number>(0);
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
    this.attachRemoteStream();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['callState']) {
      if (this.callState === 'connected' && !this.timerInterval) {
        this.startTimer();
      } else if (this.callState !== 'connected' && this.timerInterval) {
        this.stopTimer();
      }
    }

    if (changes['remoteStream']) {
      this.attachRemoteStream();
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

  private attachRemoteStream(): void {
    if (this.remoteAudioRef && this.remoteAudioRef.nativeElement && this.remoteStream) {
      try {
        this.remoteAudioRef.nativeElement.srcObject = this.remoteStream;
        this.remoteAudioRef.nativeElement.play().catch(() => {});
      } catch {}
    }
  }
}
