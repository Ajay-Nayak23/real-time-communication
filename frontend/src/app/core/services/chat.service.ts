import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
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
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/chat/conversations`;

  // Reactive state signals
  readonly conversations = signal<Conversation[]>([]);
  readonly activeConversation = signal<Conversation | null>(null);
  readonly messages = signal<Message[]>([]);
  readonly loadingConversations = signal<boolean>(false);
  readonly loadingMessages = signal<boolean>(false);
  readonly sendingMessage = signal<boolean>(false);
  readonly error = signal<string | null>(null);

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
   */
  sendMessage(conversationId: number, content: string): Observable<Message> {
    this.sendingMessage.set(true);
    const payload: SendMessageRequest = { content: content.trim() };

    return this.http.post<Message>(`${this.apiUrl}/${conversationId}/messages/`, payload).pipe(
      tap((newMsg) => {
        this.sendingMessage.set(false);
        // Append message to message list
        this.messages.update((msgs) => [...msgs, newMsg]);

        // Update last message in the conversations list
        this.conversations.update((convList) => {
          const index = convList.findIndex((c) => c.id === conversationId);
          if (index >= 0) {
            const updatedConv: Conversation = {
              ...convList[index],
              updated_at: newMsg.created_at,
              last_message: {
                id: newMsg.id,
                sender_id: newMsg.sender.id,
                sender_name: newMsg.sender.name || newMsg.sender.email,
                content: newMsg.content,
                is_read: newMsg.is_read,
                created_at: newMsg.created_at,
              },
            };
            const copy = [...convList];
            copy.splice(index, 1);
            return [updatedConv, ...copy];
          }
          return convList;
        });
      }),
      catchError((err) => {
        this.sendingMessage.set(false);
        this.error.set('Failed to send message.');
        return throwError(() => err);
      })
    );
  }

  /**
   * Select a conversation as active and load its message history.
   */
  selectConversation(conv: Conversation | null): void {
    this.activeConversation.set(conv);
    if (conv) {
      this.loadMessages(conv.id).subscribe();
    } else {
      this.messages.set([]);
    }
  }

  clearActiveConversation(): void {
    this.selectConversation(null);
  }
}
