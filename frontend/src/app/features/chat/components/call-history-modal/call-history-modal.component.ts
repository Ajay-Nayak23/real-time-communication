import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { CallService } from '../../../../core/services/call.service';
import { CallRecord } from '../../../../core/models/call.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-call-history-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-backdrop" (click)="close.emit()" role="dialog" aria-modal="true" aria-labelledby="historyTitle">
      <div class="modal-card" (click)="$event.stopPropagation()">
        <!-- Header -->
        <div class="modal-header">
          <div class="header-left">
            <div class="header-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </div>
            <h3 id="historyTitle">Call History</h3>
          </div>
          <button type="button" class="btn-close" (click)="close.emit()" aria-label="Close modal">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 6 6 18M6 6l12 12"></path>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="modal-body">
          @if (loading()) {
            <div class="loading-state">
              <span class="spinner"></span>
              <p>Loading call logs...</p>
            </div>
          } @else if (calls().length === 0) {
            <div class="empty-state">
              <div class="empty-circle">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                </svg>
              </div>
              <h4>No calls yet</h4>
              <p>Your audio and video call history will appear here.</p>
            </div>
          } @else {
            <div class="call-list">
              @for (call of calls(); track call.id) {
                <div class="call-item">
                  <div class="avatar" [style.background]="getAvatarColor(getPartner(call)?.id || 1)">
                    {{ getInitials(getPartner(call)) }}
                  </div>

                  <div class="call-info">
                    <span class="call-partner">{{ getDisplayName(getPartner(call)) }}</span>
                    <div class="call-meta-line">
                      <span class="status-badge" [ngClass]="call.status">
                        {{ call.status }}
                      </span>
                      @if (call.duration > 0) {
                        <span class="duration">{{ formatDuration(call.duration) }}</span>
                      }
                      <span class="timestamp">{{ formatTimestamp(call.created_at) }}</span>
                    </div>
                  </div>

                  @if (getPartner(call); as partner) {
                    <button
                      type="button"
                      class="btn-call-back"
                      (click)="onCallBack(partner)"
                      title="Call back"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      Call
                    </button>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(10px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1200;
      padding: 1rem;
      animation: fadeIn 0.2s ease-out;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .modal-card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      width: 100%;
      max-width: 480px;
      max-height: 82vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.15rem 1.4rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      h3 { margin: 0; font-size: 1.15rem; color: #f8fafc; font-weight: 700; }
    }

    .header-icon {
      width: 34px;
      height: 34px;
      border-radius: 8px;
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .btn-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 6px;
      &:hover { color: #f8fafc; background: rgba(255, 255, 255, 0.06); }
    }

    .modal-body {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 1.4rem 1.5rem;
    }

    .loading-state, .empty-state {
      padding: 3rem 1rem;
      text-align: center;
      color: #94a3b8;
    }

    .spinner {
      display: inline-block;
      width: 24px;
      height: 24px;
      border: 2px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    .empty-circle {
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.1);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1rem;
    }

    .empty-state h4 {
      margin: 0 0 0.35rem;
      color: #f1f5f9;
      font-size: 1.1rem;
    }

    .empty-state p {
      margin: 0;
      font-size: 0.85rem;
      color: #64748b;
    }

    .call-list {
      display: flex;
      flex-direction: column;
      gap: 0.65rem;
    }

    .call-item {
      display: flex;
      align-items: center;
      gap: 0.85rem;
      padding: 0.75rem 0.85rem;
      border-radius: 12px;
      background: rgba(15, 23, 42, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.2s;
      &:hover {
        background: rgba(59, 130, 246, 0.1);
        border-color: rgba(59, 130, 246, 0.25);
      }
    }

    .avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #ffffff;
      font-size: 0.9rem;
      flex-shrink: 0;
    }

    .call-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 0.2rem;
    }

    .call-partner {
      font-weight: 600;
      color: #f8fafc;
      font-size: 0.925rem;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .call-meta-line {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.75rem;
      color: #94a3b8;
    }

    .status-badge {
      text-transform: capitalize;
      font-weight: 600;
      padding: 0.1rem 0.4rem;
      border-radius: 4px;
      font-size: 0.7rem;

      &.ended, &.ongoing {
        background: rgba(16, 185, 129, 0.15);
        color: #34d399;
      }
      &.missed {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
      }
      &.rejected, &.failed, &.busy {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
      }
    }

    .duration {
      color: #cbd5e1;
      font-family: monospace;
    }

    .btn-call-back {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.8rem;
      border-radius: 8px;
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #60a5fa;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      &:hover {
        background: #3b82f6;
        color: #ffffff;
      }
    }
  `],
})
export class CallHistoryModalComponent implements OnInit {
  @Output() close = new EventEmitter<void>();
  @Output() callRequested = new EventEmitter<User>();

  private readonly callService = inject(CallService);

  calls = signal<CallRecord[]>([]);
  loading = signal<boolean>(false);

  ngOnInit(): void {
    this.fetchCallHistory();
  }

  fetchCallHistory(): void {
    this.loading.set(true);
    this.callService.getCallHistory().subscribe({
      next: (res) => {
        this.calls.set(res.results || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      },
    });
  }

  onCallBack(partner: User): void {
    this.callRequested.emit(partner);
    this.close.emit();
  }

  getPartner(call: CallRecord): User | null | undefined {
    return call.other_participant || call.callee;
  }

  getDisplayName(user?: User | null): string {
    if (!user) return 'Participant';
    return user.name || user.email.split('@')[0];
  }

  getInitials(user?: User | null): string {
    if (!user) return '?';
    const name = user.name || user.email;
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  getAvatarColor(id: number): string {
    const colors = [
      'linear-gradient(135deg, #3b82f6, #1d4ed8)',
      'linear-gradient(135deg, #8b5cf6, #6d28d9)',
      'linear-gradient(135deg, #ec4899, #be185d)',
      'linear-gradient(135deg, #10b981, #047857)',
      'linear-gradient(135deg, #f59e0b, #b45309)',
    ];
    return colors[id % colors.length];
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    return date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
