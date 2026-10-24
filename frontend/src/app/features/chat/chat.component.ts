import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { PresenceService } from '../../core/services/presence.service';
import { UserService } from '../../core/services/user.service';
import { Conversation } from '../../core/models/chat.model';
import { User } from '../../core/models/user.model';
import { ConversationListComponent } from './components/conversation-list/conversation-list.component';
import { MessageWindowComponent } from './components/message-window/message-window.component';
import { MessageInputComponent } from './components/message-input/message-input.component';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ConversationListComponent,
    MessageWindowComponent,
    MessageInputComponent,
  ],
  template: `
    <div class="chat-layout" [class.mobile-thread-open]="mobileThreadOpen()">
      <!-- Conversation Sidebar -->
      <div class="sidebar-pane">
        <app-conversation-list
          [conversations]="chatService.conversations()"
          [selectedId]="chatService.activeConversation()?.id || null"
          [onlineUserIds]="presenceService.onlineUserIds()"
          (conversationSelected)="onSelectConversation($event)"
          (newChatClicked)="openNewChatModal()"
        ></app-conversation-list>
      </div>

      <!-- Main Chat Area -->
      <main class="chat-main-pane">
        @if (chatService.activeConversation(); as activeConv) {
          <div class="active-thread-container">
            <app-message-window
              [conversation]="activeConv"
              [messages]="chatService.messages()"
              [currentUserId]="authService.currentUser()?.id || null"
              [loading]="chatService.loadingMessages()"
              [showBackButton]="true"
              [isPartnerOnline]="presenceService.isUserOnline(activeConv.other_participant?.id)"
              [typingUser]="chatService.typingUser()"
              (backClicked)="closeMobileThread()"
            ></app-message-window>

            <app-message-input
              [disabled]="chatService.sendingMessage()"
              (messageSent)="onSendMessage($event)"
              (typingChanged)="chatService.sendTyping($event)"
            ></app-message-input>
          </div>
        } @else {
          <!-- Empty State when no conversation is selected -->
          <div class="no-selection-state">
            <div class="no-selection-card">
              <div class="hero-circle">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </div>
              <h2>Select a Conversation</h2>
              <p class="desc">
                Choose a conversation from the sidebar or start a new thread to begin real-time messaging.
              </p>
              <button type="button" class="btn-primary" (click)="openNewChatModal()">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M12 5v14M5 12h14"></path>
                </svg>
                Start New Chat
              </button>
            </div>
          </div>
        }
      </main>

      <!-- New Chat User Discovery Modal -->
      @if (showNewChatModal()) {
        <div class="modal-backdrop" (click)="closeNewChatModal()">
          <div class="modal-card" (click)="$event.stopPropagation()" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
            <div class="modal-header">
              <h3 id="modalTitle">Start a New Conversation</h3>
              <button type="button" class="modal-close" (click)="closeNewChatModal()" aria-label="Close modal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 6 6 18M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div class="modal-search">
              <input
                type="text"
                [(ngModel)]="userSearchQuery"
                (ngModelChange)="onSearchUsers()"
                placeholder="Search users by name or email..."
                class="user-search-input"
              />
            </div>

            <div class="modal-body">
              @if (loadingUsers()) {
                <div class="modal-loading">
                  <span class="spinner"></span>
                  <p>Searching users...</p>
                </div>
              } @else if (usersList().length === 0) {
                <div class="modal-empty">
                  <p>No available users found.</p>
                </div>
              } @else {
                <div class="user-list">
                  @for (user of usersList(); track user.id) {
                    <div class="user-item" (click)="startChatWithUser(user)" role="button" tabindex="0">
                      <div class="user-avatar" [style.background]="getAvatarColor(user.id)">
                        {{ getInitials(user) }}
                      </div>
                      <div class="user-info">
                        <span class="user-name">{{ user.name || user.email }}</span>
                        <span class="user-email">{{ user.email }}</span>
                      </div>
                      <button type="button" class="btn-connect">Chat</button>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .chat-layout {
      display: flex;
      height: calc(100vh - 70px);
      width: 100%;
      overflow: hidden;
      background: radial-gradient(circle at 15% 20%, rgba(30, 58, 138, 0.25) 0%, rgba(15, 23, 42, 0.95) 100%);
    }

    .sidebar-pane {
      width: 340px;
      min-width: 280px;
      max-width: 400px;
      height: 100%;
      flex-shrink: 0;
    }

    .chat-main-pane {
      flex: 1;
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      background: rgba(15, 23, 42, 0.4);
    }

    .active-thread-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      width: 100%;
    }

    app-message-window { flex: 1; min-height: 0; }
    app-message-input { flex-shrink: 0; }

    .no-selection-state {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      padding: 2rem;
    }

    .no-selection-card {
      background: rgba(30, 41, 59, 0.6);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 20px;
      padding: 3rem 2rem;
      max-width: 460px;
      text-align: center;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
    }

    .hero-circle {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      margin: 0 auto 1.25rem;
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(99, 102, 241, 0.2));
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #60a5fa;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    h2 { color: #f8fafc; font-size: 1.5rem; font-weight: 700; margin: 0 0 0.5rem; }
    .desc { color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.75rem; }

    .btn-primary {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.7rem 1.4rem;
      border-radius: 10px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border: none;
      color: #fff;
      font-weight: 600;
      font-size: 0.9rem;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(59, 130, 246, 0.35);
      transition: transform 0.2s;
      &:hover { transform: translateY(-2px); }
    }

    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(8px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 1rem;
    }

    .modal-card {
      background: #1e293b;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      width: 100%;
      max-width: 460px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 1.25rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      h3 { margin: 0; font-size: 1.15rem; color: #f8fafc; }
    }

    .modal-close {
      background: transparent;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      &:hover { color: #f1f5f9; }
    }

    .modal-search { padding: 0.75rem 1.25rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); }

    .user-search-input {
      width: 100%;
      padding: 0.6rem 0.85rem;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f8fafc;
      font-size: 0.875rem;
      outline: none;
      &:focus { border-color: #3b82f6; }
    }

    .modal-body { flex: 1; overflow-y: auto; padding: 0.75rem 1.25rem 1.25rem; }
    .user-list { display: flex; flex-direction: column; gap: 0.5rem; }

    .user-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.65rem;
      border-radius: 10px;
      cursor: pointer;
      background: rgba(15, 23, 42, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.04);
      transition: background 0.2s;
      &:hover { background: rgba(59, 130, 246, 0.15); border-color: rgba(59, 130, 246, 0.3); }
    }

    .user-avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      color: #fff;
      font-size: 0.85rem;
      flex-shrink: 0;
    }

    .user-info { flex: 1; min-width: 0; display: flex; flex-direction: column; }
    .user-name { font-weight: 600; color: #f8fafc; font-size: 0.9rem; }
    .user-email { font-size: 0.775rem; color: #94a3b8; }

    .btn-connect {
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #60a5fa;
      padding: 0.35rem 0.75rem;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      cursor: pointer;
      &:hover { background: #3b82f6; color: #fff; }
    }

    .modal-loading, .modal-empty { padding: 2rem 1rem; text-align: center; color: #94a3b8; }
    .spinner {
      display: inline-block;
      width: 22px;
      height: 22px;
      border: 2px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin { to { transform: rotate(360deg); } }

    @media (max-width: 768px) {
      .sidebar-pane { width: 100%; max-width: 100%; }
      .chat-main-pane { display: none; }
      .chat-layout.mobile-thread-open {
        .sidebar-pane { display: none; }
        .chat-main-pane { display: flex; width: 100%; }
      }
    }
  `],
})
export class ChatComponent implements OnInit {
  readonly authService = inject(AuthService);
  readonly chatService = inject(ChatService);
  readonly userService = inject(UserService);
  readonly presenceService = inject(PresenceService);

  mobileThreadOpen = signal<boolean>(false);
  showNewChatModal = signal<boolean>(false);
  usersList = signal<User[]>([]);
  loadingUsers = signal<boolean>(false);
  userSearchQuery = '';

  ngOnInit(): void {
    this.presenceService.connect();
    this.chatService.loadConversations().subscribe();
  }

  onSelectConversation(conv: Conversation): void {
    this.chatService.selectConversation(conv);
    this.mobileThreadOpen.set(true);
  }

  closeMobileThread(): void {
    this.mobileThreadOpen.set(false);
    this.chatService.clearActiveConversation();
  }

  onSendMessage(content: string): void {
    const active = this.chatService.activeConversation();
    if (active && content.trim()) {
      this.chatService.sendMessage(active.id, content).subscribe();
    }
  }

  openNewChatModal(): void {
    this.showNewChatModal.set(true);
    this.fetchUsers();
  }

  closeNewChatModal(): void {
    this.showNewChatModal.set(false);
    this.userSearchQuery = '';
  }

  fetchUsers(): void {
    this.loadingUsers.set(true);
    this.userService.getUsers({ search: this.userSearchQuery }).subscribe({
      next: (res) => {
        this.usersList.set(res.results);
        this.loadingUsers.set(false);
      },
      error: () => {
        this.loadingUsers.set(false);
      },
    });
  }

  onSearchUsers(): void {
    this.fetchUsers();
  }

  startChatWithUser(user: User): void {
    this.chatService.createConversation({ recipient_id: user.id }).subscribe({
      next: (conv) => {
        this.closeNewChatModal();
        this.mobileThreadOpen.set(true);
      },
      error: (err) => {
        console.error('Error starting conversation:', err);
      },
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
}
