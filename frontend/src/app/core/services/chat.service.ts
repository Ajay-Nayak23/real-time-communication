import { Injectable, PLATFORM_ID, inject, signal, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import {
  Conversation,
  CreateConversationRequest,
  Message,
  MessageHistoryResponse,
  SendMessageRequest,
} from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class ChatService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly apiUrl = `${environment.apiUrl}/chat/conversations`;
  private readonly wsBaseUrl = environment.wsUrl || 'ws://127.0.0.1:8000/ws';

  // Reactive state signals
  readonly conversations = signal<Conversation[]>([]);
  readonly activeConversation = signal<Conversation | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly loadingConversations = signal<boolean>(false);
  readonly loadingMessages = signal<boolean>(false);
  readonly sendingMessage = signal<boolean>(false);
  readonly error = signal<string | null>(null);
  readonly socketConnected = signal<boolean>(false);

  // Active WebSocket reference & reconnect timer
  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private shouldReconnect = true;

  ngOnDestroy(): void {
    this.disconnectWebSocket();
  }

  /**
   * Fetch all conversations for the authenticated user and update signal.
   */
  loadConversations(): Observable<Conversation[]> {
    this.loadingConversations.set(true);
    this.error.set(null);
    return this.http.get<Conversation[]>(`${this.apiUrl}/`).pipe(
      tap((convs) => {
        this.conversations.set(convs);
        this.loadingConversations.set(false);

        // Keep active conversation reference in sync if selected
        const currentActive = this.activeConversation();
        if (currentActive) {
          const updated = convs.find((c) => c.id === currentActive.id);
          if (updated) {
            this.activeConversation.set(updated);
          }
        }
      }),
      catchError((err) => {
        this.loadingConversations.set(false);
        this.error.set('Failed to load conversations.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Retrieve details for a single conversation.
   */
  getConversation(id: number): Observable<Conversation> {
    return this.http.get<Conversation>(`${this.apiUrl}/${id}/`).pipe(
      tap((conv) => {
        this.activeConversation.set(conv);
      })
    );
  }

  /**
   * Start a new conversation or retrieve existing thread with a user.
   */
  createConversation(data: CreateConversationRequest): Observable<Conversation> {
    return this.http.post<Conversation>(`${this.apiUrl}/`, data).pipe(
      tap((conv) => {
        const list = this.conversations();
        const existingIndex = list.findIndex((c) => c.id === conv.id);
        if (existingIndex >= 0) {
          list[existingIndex] = conv;
          this.conversations.set([...list]);
        } else {
          this.conversations.set([conv, ...list]);
        }
        this.selectConversation(conv);
      })
    );
  }

  /**
   * Fetch paginated message history for a conversation.
   */
  getMessages(
    conversationId: number,
    params?: { ordering?: string; page?: number; page_size?: number }
  ): Observable<MessageHistoryResponse> {
    let httpParams = new HttpParams();
    if (params?.ordering) {
      httpParams = httpParams.set('ordering', params.ordering);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.page_size) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }

    return this.http.get<MessageHistoryResponse>(`${this.apiUrl}/${conversationId}/messages/`, {
      params: httpParams,
    });
  }

  /**
   * Load chronological messages for the active conversation and update signals.
   */
  loadMessages(conversationId: number): Observable<MessageHistoryResponse> {
    this.loadingMessages.set(true);
    this.error.set(null);
    return this.getMessages(conversationId, { ordering: 'created_at' }).pipe(
      tap((res) => {
        this.messages.set(res.results);
        this.loadingMessages.set(false);
      }),
      catchError((err) => {
        this.loadingMessages.set(false);
        this.error.set('Failed to load messages.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Send a new message to a conversation.
   * If WebSocket is connected, dispatches via WebSocket in real time.
   * Falls back to HTTP POST if WebSocket is disconnected or offline.
   */
  sendMessage(conversationId: number, content: string): Observable<Message> {
    const trimmed = content.trim();

    // If WebSocket is open and connected to the active conversation, send over WebSocket
    if (this.isSocketOpen() && Number(this.activeConversation()?.id) === Number(conversationId)) {
      try {
        this.socket!.send(
          JSON.stringify({
            type: 'chat_message',
            content: trimmed,
          })
        );
        // The server will broadcast the message back to all conversation participants,
        // which triggers handleIncomingMessage and updates signals.
        return of({} as Message);
      } catch {
        // Fall back to HTTP POST on error
      }
    }

    this.sendingMessage.set(true);
    const payload: SendMessageRequest = { content: trimmed };

    return this.http.post<Message>(`${this.apiUrl}/${conversationId}/messages/`, payload).pipe(
      tap((newMsg) => {
        this.sendingMessage.set(false);
        this.appendMessage(newMsg);
        this.updateConversationLastMessage(newMsg, false);
      }),
      catchError((err) => {
        this.sendingMessage.set(false);
        this.error.set('Failed to send message.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Select a conversation as active, load historical messages,
   * establish a real-time WebSocket connection, and clear unread count.
   */
  selectConversation(conv: Conversation | null): void {
    this.disconnectWebSocket();
    this.activeConversation.set(conv);
    if (conv) {
      this.loadMessages(conv.id).subscribe();
      this.connectWebSocket(conv.id);
      this.markConversationAsRead(conv.id).subscribe({
        error: () => {},
      });
    } else {
      this.messages.set([]);
    }
  }

  clearActiveConversation(): void {
    this.selectConversation(null);
  }

  /**
   * Mark all unread messages in a conversation as read.
   * Clears the local unread badge, notifies peers via WebSocket, and syncs with backend.
   */
  markConversationAsRead(
    conversationId: number
  ): Observable<{ status: string; conversation_id: number; read_count: number }> {
    // 1. Immediately clear unread badge in conversation list
    this.conversations.update((convList) =>
      convList.map((c) => (c.id === conversationId ? { ...c, unread_count: 0 } : c))
    );

    const active = this.activeConversation();
    if (active && Number(active.id) === Number(conversationId)) {
      this.activeConversation.set({ ...active, unread_count: 0 });
    }

    // 2. If connected to this conversation via WebSocket, dispatch mark_read event
    if (this.isSocketOpen() && Number(active?.id) === Number(conversationId)) {
      try {
        this.socket!.send(JSON.stringify({ type: 'mark_read' }));
      } catch {
        // ignore socket send failure
      }
    }

    // 3. Post to backend REST API to ensure persistence
    return this.http.post<{ status: string; conversation_id: number; read_count: number }>(
      `${this.apiUrl}/${conversationId}/read/`,
      {}
    );
  }

  /**
   * Connect to the conversation's real-time WebSocket endpoint.
   */
  connectWebSocket(conversationId: number): void {
    if (!isPlatformBrowser(this.platformId) || typeof WebSocket === 'undefined') {
      return;
    }

    this.disconnectWebSocket();
    this.shouldReconnect = true;

    const token = this.authService.getAccessToken();
    if (!token) {
      console.warn('[WebSocket] Cannot connect: missing access token');
      return;
    }

    const wsUrl = `${this.wsBaseUrl}/chat/${conversationId}/?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.socketConnected.set(true);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'chat_message' && data.message) {
            this.handleIncomingMessage(data.message);
          } else if (data.type === 'messages_read' || data.type === 'chat_messages_read') {
            this.handleMessagesRead(data);
          } else if (data.type === 'connection_established') {
            this.socketConnected.set(true);
          }
        } catch {
          // ignore non-json frames
        }
      };

      this.socket.onclose = (event: CloseEvent) => {
        console.warn(`[WebSocket] Closed (code: ${event.code}, reason: ${event.reason})`);
        this.socketConnected.set(false);
        this.socket = null;
        if (this.shouldReconnect && Number(this.activeConversation()?.id) === Number(conversationId)) {
          this.reconnectTimer = setTimeout(() => {
            if (this.shouldReconnect && Number(this.activeConversation()?.id) === Number(conversationId)) {
              this.connectWebSocket(conversationId);
            }
          }, 3000);
        }
      };

      this.socket.onerror = (err) => {
        console.error('[WebSocket] Error event:', err);
        this.socketConnected.set(false);
      };
    } catch (e) {
      console.error('[WebSocket] Failed to instantiate:', e);
      this.socketConnected.set(false);
    }
  }

  /**
   * Disconnect and clean up active WebSocket connection.
   */
  disconnectWebSocket(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {
        // ignore close error
      }
      this.socket = null;
    }
    this.socketConnected.set(false);
  }

  /**
   * Helper to check if WebSocket is active and ready.
   */
  isSocketOpen(): boolean {
    return (
      !!this.socket &&
      typeof WebSocket !== 'undefined' &&
      this.socket.readyState === WebSocket.OPEN
    );
  }

  /**
   * Process incoming message:
   * - If viewing the conversation: append and mark read immediately.
   * - If not viewing the conversation: increment unread badge counter.
   */
  handleIncomingMessage(newMsg: Message): void {
    const currentActiveId = Number(this.activeConversation()?.id);
    const msgConvId = Number(newMsg.conversation_id);
    const isCurrentActive =
      currentActiveId === msgConvId ||
      (!this.activeConversation() &&
        this.messages().some((m) => Number(m.conversation_id) === msgConvId));

    const currentUserId = Number(this.authService.currentUser()?.id);
    const isFromSelf = Number(newMsg.sender.id) === currentUserId;

    // If conversation is currently open and message is from peer, immediately mark as read
    if (isCurrentActive && !isFromSelf) {
      newMsg.is_read = true;
      if (this.isSocketOpen()) {
        try {
          this.socket!.send(JSON.stringify({ type: 'mark_read' }));
        } catch {}
      }
    }

    // 1. Deduplicate in message timeline if viewing this conversation
    if (isCurrentActive || isFromSelf) {
      this.appendMessage(newMsg);
    }

    // 2. Update conversation list preview, order, and unread counter
    this.updateConversationLastMessage(newMsg, !isCurrentActive && !isFromSelf);
  }

  appendMessage(newMsg: Message): void {
    this.messages.update((msgs) => {
      if (msgs.some((m) => Number(m.id) === Number(newMsg.id))) {
        return msgs;
      }
      return [...msgs, newMsg];
    });
  }

  updateConversationLastMessage(newMsg: Message, incrementUnread: boolean): void {
    this.conversations.update((convList) => {
      const index = convList.findIndex((c) => Number(c.id) === Number(newMsg.conversation_id));
      if (index >= 0) {
        const existing = convList[index];
        const newUnreadCount = incrementUnread
          ? (existing.unread_count || 0) + 1
          : (Number(this.activeConversation()?.id) === Number(newMsg.conversation_id) ? 0 : existing.unread_count);

        const updatedConv: Conversation = {
          ...existing,
          updated_at: newMsg.created_at,
          unread_count: newUnreadCount,
          last_message: {
            id: newMsg.id,
            sender_id: newMsg.sender.id,
            sender_name: newMsg.sender.name || newMsg.sender.email,
            content: newMsg.content,
            is_read: newMsg.is_read,
            read_at: newMsg.read_at,
            created_at: newMsg.created_at,
          },
        };
        const copy = [...convList];
        copy.splice(index, 1);
        return [updatedConv, ...copy];
      }
      return convList;
    });
  }

  /**
   * Handle real-time read receipt broadcast:
   * Updates all sent messages in the active thread to is_read = true with read_at timestamp.
   */
  handleMessagesRead(data: {
    conversation_id: number;
    reader_id: number;
    read_at: string;
    read_count: number;
  }): void {
    if (Number(this.activeConversation()?.id) === Number(data.conversation_id)) {
      this.messages.update((msgs) =>
        msgs.map((m) => (!m.is_read ? { ...m, is_read: true, read_at: data.read_at } : m))
      );
    }

    this.conversations.update((convList) => {
      const index = convList.findIndex((c) => Number(c.id) === Number(data.conversation_id));
      if (index >= 0 && convList[index].last_message) {
        const updatedConv: Conversation = {
          ...convList[index],
          last_message: {
            ...convList[index].last_message!,
            is_read: true,
            read_at: data.read_at,
          },
        };
        const copy = [...convList];
        copy[index] = updatedConv;
        return copy;
      }
      return convList;
    });
  }
}

