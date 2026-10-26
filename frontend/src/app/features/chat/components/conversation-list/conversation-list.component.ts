import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Conversation } from '../../../../core/models/chat.model';
import { User } from '../../../../core/models/user.model';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="conversation-sidebar" aria-label="Conversation list">
      <div class="sidebar-header">
        <div class="header-title-row">
          <h2 class="sidebar-title">Chats</h2>
          <div class="header-actions">
            <button
              type="button"
              class="btn-icon"
              (click)="callHistoryClicked.emit()"
              title="View Call History"
              aria-label="View Call History"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
              </svg>
            </button>
            <button
              type="button"
              class="btn-icon"
              (click)="newChatClicked.emit()"
              title="Start new conversation"
              aria-label="Start new conversation"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 5v14M5 12h14"></path>
              </svg>
            </button>
          </div>
        </div>

        <div class="search-box">
          <svg class="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"></circle>
            <path d="m21 21-4.35-4.35"></path>
          </svg>
          <input
            type="text"
            [(ngModel)]="searchQuery"
            placeholder="Search conversations..."
            class="search-input"
            aria-label="Search conversations"
          />
        </div>
      </div>

      <div class="conversation-items" role="list">
        @if (filteredConversations.length === 0) {
          <div class="empty-list">
            <div class="empty-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
              </svg>
            </div>
            <p class="empty-text">No conversations yet</p>
            <button type="button" class="btn-start" (click)="newChatClicked.emit()">
              Start a Conversation
            </button>
          </div>
        } @else {
          @for (conv of filteredConversations; track conv.id) {
            <div
              class="conversation-card"
              [class.active]="selectedId === conv.id"
              (click)="conversationSelected.emit(conv)"
              role="listitem"
              tabindex="0"
              (keydown.enter)="conversationSelected.emit(conv)"
              (keydown.space)="conversationSelected.emit(conv)"
            >
              <div class="avatar-container">
                @if (conv.other_participant?.avatar || conv.other_participant?.profile_image) {
                  <img
                    [src]="conv.other_participant?.avatar || conv.other_participant?.profile_image"
                    [alt]="getDisplayName(conv.other_participant)"
                    class="avatar-img"
                  />
                } @else {
                  <div class="avatar-fallback" [style.background]="getAvatarColor(conv.id)">
                    {{ getInitials(conv.other_participant) }}
                  </div>
                }
                <span class="status-dot" [class.online]="isOnline(conv.other_participant)"></span>
              </div>

              <div class="conv-details">
                <div class="conv-top-row">
                  <span class="partner-name">{{ getDisplayName(conv.other_participant) }}</span>
                  @if (conv.last_message?.created_at) {
                    <span class="time-label">{{ formatTime(conv.last_message?.created_at) }}</span>
                  }
                </div>

                <div class="conv-bottom-row">
                  <span class="message-preview">
                    {{ conv.last_message?.content || 'No messages yet' }}
                  </span>
                  <div class="conv-meta-actions">
                    @if (conv.unread_count > 0) {
                      <span class="unread-badge">{{ conv.unread_count }}</span>
                    }
                    @if (conv.other_participant) {
                      <button
                        type="button"
                        class="btn-card-call btn-card-audio"
                        (click)="onCallClick($event, conv.other_participant)"
                        title="Start Audio Call"
                        aria-label="Start Audio Call"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                        </svg>
                      </button>
                      <button
                        type="button"
                        class="btn-card-call btn-card-video"
                        (click)="onVideoCallClick($event, conv.other_participant)"
                        title="Start Video Call"
                        aria-label="Start Video Call"
                      >
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                          <polygon points="23 7 16 12 23 17 23 7"></polygon>
                          <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                      </button>
                    }
                  </div>
                </div>
              </div>
            </div>
          }
        }
      </div>
    </aside>
  `,
  styles: [`
    .conversation-sidebar {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(20px);
      border-right: 1px solid rgba(255, 255, 255, 0.08);
    }

    .sidebar-header {
      padding: 1.25rem 1rem 0.75rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    }

    .header-title-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .sidebar-title {
      font-size: 1.35rem;
      font-weight: 700;
      color: #f8fafc;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 0.4rem;
    }

    .btn-icon {
      background: rgba(59, 130, 246, 0.15);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
      width: 36px;
      height: 36px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: all 0.2s ease;
      &:hover {
        background: rgba(59, 130, 246, 0.3);
        transform: scale(1.05);
      }
    }

    .search-box {
      position: relative;
      display: flex;
      align-items: center;
    }

    .search-icon {
      position: absolute;
      left: 0.75rem;
      color: #64748b;
      pointer-events: none;
    }

    .search-input {
      width: 100%;
      padding: 0.6rem 0.75rem 0.6rem 2.25rem;
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 8px;
      color: #f1f5f9;
      font-size: 0.875rem;
      outline: none;
      transition: all 0.2s ease;
      &::placeholder {
        color: #64748b;
      }
      &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        background: rgba(30, 41, 59, 0.9);
      }
    }

    .conversation-items {
      flex: 1;
      overflow-y: auto;
      padding: 0.5rem;
    }

    .empty-list {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 3rem 1rem;
      text-align: center;
    }

    .empty-icon {
      color: #64748b;
      margin-bottom: 0.75rem;
    }

    .empty-text {
      color: #94a3b8;
      font-size: 0.9rem;
      margin-bottom: 1.25rem;
    }

    .btn-start {
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border: none;
      color: #ffffff;
      padding: 0.5rem 1rem;
      border-radius: 8px;
      font-size: 0.85rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      &:hover {
        opacity: 0.95;
        transform: translateY(-1px);
      }
    }

    .conversation-card {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.75rem;
      border-radius: 10px;
      margin-bottom: 0.25rem;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.2s ease;

      &:hover {
        background: rgba(51, 65, 85, 0.35);
      }

      &.active {
        background: rgba(59, 130, 246, 0.15);
        border-color: rgba(59, 130, 246, 0.3);
      }
    }

    .avatar-container {
      position: relative;
      width: 44px;
      height: 44px;
      flex-shrink: 0;
    }

    .avatar-img {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
    }

    .avatar-fallback {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.95rem;
      font-weight: 700;
      color: #ffffff;
    }

    .status-dot {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #64748b;
      border: 2px solid #0f172a;
      &.online {
        background: #10b981;
      }
    }

    .conv-details {
      flex: 1;
      min-width: 0;
    }

    .conv-top-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 0.25rem;
    }

    .partner-name {
      font-size: 0.95rem;
      font-weight: 600;
      color: #f1f5f9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .time-label {
      font-size: 0.75rem;
      color: #64748b;
      margin-left: 0.5rem;
      flex-shrink: 0;
    }

    .conv-bottom-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 0.5rem;
    }

    .message-preview {
      font-size: 0.825rem;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .conv-meta-actions {
      display: flex;
      align-items: center;
      gap: 0.35rem;
      flex-shrink: 0;
    }

    .btn-card-call {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 6px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(59, 130, 246, 0.25);
      color: #60a5fa;
      cursor: pointer;
      opacity: 0.8;
      transition: all 0.2s;
      svg { pointer-events: none; }
      &:hover {
        opacity: 1;
        background: #3b82f6;
        color: #ffffff;
        transform: scale(1.05);
      }
    }

    .unread-badge {
      background: #3b82f6;
      color: #ffffff;
      font-size: 0.7rem;
      font-weight: 700;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
  `],
})
export class ConversationListComponent {
  @Input() conversations: Conversation[] = [];
  @Input() selectedId: number | null = null;
  @Input() onlineUserIds: Set<number> = new Set();
  @Output() conversationSelected = new EventEmitter<Conversation>();
  @Output() newChatClicked = new EventEmitter<void>();
  @Output() callHistoryClicked = new EventEmitter<void>();
  @Output() callUser = new EventEmitter<User>();
  @Output() videoCallUser = new EventEmitter<User>();

  searchQuery = '';

  get filteredConversations(): Conversation[] {
    if (!this.searchQuery.trim()) {
      return this.conversations;
    }
    const q = this.searchQuery.toLowerCase().trim();
    return this.conversations.filter((c) => {
      const name = this.getDisplayName(c.other_participant).toLowerCase();
      const email = c.other_participant?.email?.toLowerCase() || '';
      return name.includes(q) || email.includes(q);
    });
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
    if (!user) return false;
    if (this.onlineUserIds && this.onlineUserIds.has(Number(user.id))) {
      return true;
    }
    if (!user.last_seen) return false;
    const seenTime = new Date(user.last_seen).getTime();
    return Date.now() - seenTime < 3 * 60 * 1000;
  }

  formatTime(isoDate?: string): string {
    if (!isoDate) return '';
    const date = new Date(isoDate);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  onCallClick(event: MouseEvent, user: User): void {
    event.stopPropagation();
    event.preventDefault();
    this.callUser.emit(user);
  }

  onVideoCallClick(event: MouseEvent, user: User): void {
    event.stopPropagation();
    event.preventDefault();
    this.videoCallUser.emit(user);
  }
}
