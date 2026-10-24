import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  OnDestroy,
  Output,
  HostListener,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { CallType } from '../../../../core/models/call.model';

@Component({
  selector: 'app-incoming-call-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="incoming-call-overlay" role="dialog" aria-modal="true" aria-labelledby="callerName">
      <div class="incoming-call-card">
        <!-- Animated Pulse Rings -->
        <div class="avatar-ripple-container">
          <div class="pulse-ring ring-1"></div>
          <div class="pulse-ring ring-2"></div>
          <div class="pulse-ring ring-3"></div>

          <div class="avatar-holder">
            @if (callerAvatar) {
              <img [src]="callerAvatar" [alt]="callerName" class="caller-avatar-img" />
            } @else {
              <div class="caller-avatar-fallback">
                {{ getInitials(callerName) }}
              </div>
            }
          </div>
        </div>

        <div class="caller-meta">
          <span class="call-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
            Incoming {{ callType === 'audio' ? 'Audio' : 'Video' }} Call
          </span>
          <h2 id="callerName" class="caller-name">{{ callerName }}</h2>
          <p class="call-subtitle">Ringing...</p>
        </div>

        <!-- Call Actions -->
        <div class="call-actions">
          <button
            type="button"
            class="btn-call btn-decline"
            (click)="onDecline()"
            title="Decline Call (Esc)"
            aria-label="Decline Call"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"></path>
              <line x1="23" y1="1" x2="1" y2="23"></line>
            </svg>
          </button>

          <button
            type="button"
            class="btn-call btn-accept"
            (click)="onAccept()"
            title="Accept Call (Enter)"
            aria-label="Accept Call"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .incoming-call-overlay {
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(16px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      padding: 1.5rem;
      animation: fadeIn 0.3s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .incoming-call-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(24px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 28px;
      padding: 3rem 2.5rem;
      max-width: 380px;
      width: 100%;
      text-align: center;
      box-shadow: 0 25px 60px -15px rgba(0, 0, 0, 0.6), 0 0 40px rgba(59, 130, 246, 0.15);
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .avatar-ripple-container {
      position: relative;
      width: 120px;
      height: 120px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.75rem;
    }

    .pulse-ring {
      position: absolute;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      border: 2px solid rgba(59, 130, 246, 0.6);
      animation: ripple 2s infinite cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .ring-2 {
      animation-delay: 0.6s;
      border-color: rgba(99, 102, 241, 0.5);
    }

    .ring-3 {
      animation-delay: 1.2s;
      border-color: rgba(168, 85, 247, 0.4);
    }

    @keyframes ripple {
      0% {
        transform: scale(0.9);
        opacity: 0.9;
      }
      100% {
        transform: scale(1.9);
        opacity: 0;
      }
    }

    .avatar-holder {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      overflow: hidden;
      z-index: 2;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      border: 3px solid rgba(255, 255, 255, 0.2);
    }

    .caller-avatar-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    .caller-avatar-fallback {
      width: 100%;
      height: 100%;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      color: #ffffff;
    }

    .caller-meta {
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 2.25rem;
    }

    .call-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.35rem 0.85rem;
      border-radius: 999px;
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #93c5fd;
      font-size: 0.775rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .caller-name {
      margin: 0 0 0.4rem;
      font-size: 1.5rem;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.02em;
    }

    .call-subtitle {
      margin: 0;
      font-size: 0.9rem;
      color: #94a3b8;
      animation: pulse 1.5s infinite;
    }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }

    .call-actions {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2.5rem;
      width: 100%;
    }

    .btn-call {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: none;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      color: #ffffff;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .btn-decline {
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

    .btn-accept {
      background: linear-gradient(135deg, #10b981, #059669);
      box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);
      animation: acceptPulse 1.8s infinite;
      &:hover {
        transform: scale(1.08) translateY(-2px);
        box-shadow: 0 12px 26px rgba(16, 185, 129, 0.55);
      }
      &:active {
        transform: scale(0.96);
      }
    }

    @keyframes acceptPulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.06); }
    }
  `],
})
export class IncomingCallModalComponent implements OnInit, OnDestroy {
  @Input() callerName: string = 'Incoming Caller';
  @Input() callerAvatar?: string | null = null;
  @Input() callType: CallType = 'audio';

  @Output() accepted = new EventEmitter<void>();
  @Output() rejected = new EventEmitter<void>();

  private readonly platformId = inject(PLATFORM_ID);
  private audioCtx: any = null;
  private ringInterval: any = null;

  @HostListener('window:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      this.onDecline();
    } else if (event.key === 'Enter') {
      this.onAccept();
    }
  }

  ngOnInit(): void {
    this.startRingingAudio();
  }

  ngOnDestroy(): void {
    this.stopRingingAudio();
  }

  onAccept(): void {
    this.stopRingingAudio();
    this.accepted.emit();
  }

  onDecline(): void {
    this.stopRingingAudio();
    this.rejected.emit();
  }

  getInitials(name: string): string {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  private startRingingAudio(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    try {
      const AudioCtxClass = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();

      // Play ringing chime pattern: 2 pulses every 3 seconds
      const playTone = () => {
        if (!this.audioCtx || this.audioCtx.state === 'closed') return;

        const now = this.audioCtx.currentTime;
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc1.frequency.value = 440; // A4
        osc2.type = 'sine';
        osc2.frequency.value = 480; // Standard US ringback tone

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.12, now + 0.05);
        gain.gain.setValueAtTime(0.12, now + 0.8);
        gain.gain.linearRampToValueAtTime(0, now + 0.9);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.9);
        osc2.stop(now + 0.9);
      };

      playTone();
      this.ringInterval = setInterval(playTone, 2500);
    } catch {
      // Audio playback could not be initialized or was blocked
    }
  }

  private stopRingingAudio(): void {
    if (this.ringInterval) {
      clearInterval(this.ringInterval);
      this.ringInterval = null;
    }
    if (this.audioCtx) {
      try {
        this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
