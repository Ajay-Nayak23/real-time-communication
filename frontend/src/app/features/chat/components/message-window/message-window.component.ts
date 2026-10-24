import {
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Conversation, Message } from '../../../../core/models/chat.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-message-window',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="chat-window-container" aria-label="Active conversation thread">
      <!-- Conversation Header -->
      <header class="chat-header">
        <div class="partner-info">
          @if (showBackButton) {
            <button
              type="button"
              class="btn-back"
              (click)="backClicked.emit()"
              title="Back to conversations"
              aria-label="Back to conversations"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M19 12H5M12 19l-7-7 7-7"></path>
              </svg>
            </button>
          }

          <div class="avatar-wrapper">
            @if (conversation?.other_participant?.avatar || conversation?.other_participant?.profile_image) {
              <img
                [src]="conversation?.other_participant?.avatar || conversation?.other_participant?.profile_image"
                [alt]="getDisplayName(conversation?.other_participant)"
                class="avatar-img"
              />
            } @else {
              <div class="avatar-fallback" [style.background]="getAvatarColor(conversation?.id || 1)">
                {{ getInitials(conversation?.other_participant) }}
              </div>
            }
            <span class="status-dot" [class.online]="isOnline(conversation?.other_participant)"></span>
          </div>

          <div class="header-text">
            <h3 class="header-name">{{ getDisplayName(conversation?.other_participant) }}</h3>
            <span class="header-status">
              {{ isOnline(conversation?.other_participant) ? 'Online' : 'Offline' }}
            </span>
          </div>
        </div>
      </header>

      <!-- Message History Viewport -->
      <div class="messages-viewport" #messagesViewport role="log" aria-live="polite">
        @if (loading) {
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Loading messages...</p>
          </div>
        } @else if (messages.length === 0) {
          <div class="empty-thread">
            <div class="empty-icon-circle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <h4>No messages yet</h4>
            <p>Say hello to start the conversation!</p>
          </div>
        } @else {
          <div class="message-stream">
            @for (msg of messages; track msg.id) {
              <div
                class="message-row"
                [class.outgoing]="isSelf(msg)"
                [class.incoming]="!isSelf(msg)"
              >
                @if (!isSelf(msg)) {
                  <div class="bubble-avatar">
                    @if (msg.sender.avatar || msg.sender.profile_image) {
                      <img [src]="msg.sender.avatar || msg.sender.profile_image" [alt]="msg.sender.name" class="mini-avatar" />
                    } @else {
                      <div class="mini-avatar-fallback">
                        {{ getInitials(msg.sender) }}
                      </div>
                    }
                  </div>
                }

                <div class="bubble-content-wrap">
                  @if (!isSelf(msg)) {
                    <span class="sender-name">{{ msg.sender.name || msg.sender.email }}</span>
                  }
                  <div class="msg-bubble" [class.outgoing]="isSelf(msg)" [class.incoming]="!isSelf(msg)">
                    <p class="msg-text">{{ msg.content }}</p>
                    <div class="msg-meta">
                      <span class="msg-time">{{ formatTime(msg.created_at) }}</span>
                      @if (isSelf(msg)) {
                        <span class="read-receipt" [title]="msg.is_read ? 'Read' : 'Delivered'">
                          @if (msg.is_read) {
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" stroke-width="2.5">
                              <path d="M18 6 7 17l-5-5M22 10l-7.5 7.5L13 16"></path>
                            </svg>
                          } @else {
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                              <path d="M20 6 9 17l-5-5"></path>
                            </svg>
                          }
                        </span>
                      }
                    </div>
                  </div>
                </div>
              </div>
            }
          </div>
        }
      </div>
    </section>
  `,
  styles: [`
    .chat-window-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: rgba(15, 23, 42, 0.5);
    }

    .chat-header {
      padding: 0.85rem 1.25rem;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(16px);
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 10;
    }

    .partner-info {
      display: flex;
      align-items: center;
      gap: 0.85rem;
    }

    .btn-back {
      display: none;
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      padding: 0.25rem;
      border-radius: 6px;
      &:hover {
        color: #f8fafc;
        background: rgba(255, 255, 255, 0.05);
      }
    }

    @media (max-width: 768px) {
      .btn-back {
        display: inline-flex;
        align-items: center;
      }
    }

    .avatar-wrapper {
      position: relative;
      width: 40px;
      height: 40px;
    }

    .avatar-img {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-fallback {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 700;
      color: #ffffff;
    }

    .status-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #64748b;
      border: 2px solid #0f172a;
      &.online {
        background: #10b981;
      }
    }

    .header-text {
      display: flex;
      flex-direction: column;
    }

    .header-name {
      font-size: 1rem;
      font-weight: 600;
      color: #f8fafc;
      margin: 0;
    }

    .header-status {
      font-size: 0.775rem;
      color: #94a3b8;
    }

    .messages-viewport {
      flex: 1;
      overflow-y: auto;
      padding: 1.25rem;
      scroll-behavior: smooth;
    }

    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: #94a3b8;
      gap: 0.75rem;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }

    .empty-thread {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: #94a3b8;
      h4 {
        margin: 0.75rem 0 0.25rem;
        color: #f1f5f9;
        font-size: 1.15rem;
      }
      p {
        margin: 0;
        font-size: 0.875rem;
        color: #64748b;
      }
    }

    .empty-icon-circle {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.2);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .message-stream {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .message-row {
      display: flex;
      gap: 0.5rem;
      max-width: 75%;

      &.outgoing {
        align-self: flex-end;
        flex-direction: row-reverse;
      }

      &.incoming {
        align-self: flex-start;
      }
    }

    .bubble-avatar {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
      margin-top: 14px;
    }

    .mini-avatar {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      object-fit: cover;
    }

    .mini-avatar-fallback {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #475569;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .bubble-content-wrap {
      display: flex;
      flex-direction: column;
    }

    .sender-name {
      font-size: 0.75rem;
      color: #94a3b8;
      margin-bottom: 0.2rem;
      margin-left: 0.5rem;
    }

    .msg-bubble {
      padding: 0.65rem 0.95rem;
      border-radius: 16px;
      position: relative;
      word-break: break-word;

      &.outgoing {
        background: linear-gradient(135deg, #2563eb, #4f46e5);
        color: #ffffff;
        border-bottom-right-radius: 4px;
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
      }

      &.incoming {
        background: rgba(30, 41, 59, 0.8);
        backdrop-filter: blur(8px);
        color: #f1f5f9;
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-bottom-left-radius: 4px;
      }
    }

    .msg-text {
      margin: 0;
      font-size: 0.925rem;
      line-height: 1.45;
      white-space: pre-wrap;
    }

    .msg-meta {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 0.35rem;
      margin-top: 0.25rem;
      font-size: 0.7rem;
      opacity: 0.8;
    }

    .read-receipt {
      display: inline-flex;
      align-items: center;
    }
  `],
})
export class MessageWindowComponent implements OnChanges, AfterViewInit {
  @Input() conversation: Conversation | null = null;
  @Input() messages: Message[] = [];
  @Input() currentUserId: number | null = null;
  @Input() loading = false;
  @Input() showBackButton = false;
  @Output() backClicked = new EventEmitter<void>();

  @ViewChild('messagesViewport') private messagesViewport!: ElementRef<HTMLDivElement>;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['messages'] || changes['conversation']) {
      setTimeout(() => this.scrollToBottom(), 50);
    }
  }

  ngAfterViewInit(): void {
    this.scrollToBottom();
  }

  scrollToBottom(): void {
    if (this.messagesViewport?.nativeElement) {
      const el = this.messagesViewport.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }

  isSelf(msg: Message): boolean {
    return this.currentUserId !== null && msg.sender.id === this.currentUserId;
  }

  getDisplayName(user?: User | null): string {
    if (!user) return 'Chat Participant';
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

  isOnline(user?: User | null): boolean {
    if (!user || !user.last_seen) return false;
    const seenTime = new Date(user.last_seen).getTime();
    return Date.now() - seenTime < 5 * 60 * 1000;
  }

  formatTime(isoDate?: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
}
