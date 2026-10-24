import { Injectable, PLATFORM_ID, inject, signal, OnDestroy } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, catchError, of } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { PresenceUpdate, UserPresenceStatus } from '../models/chat.model';

@Injectable({
  providedIn: 'root',
})
export class PresenceService implements OnDestroy {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly wsBaseUrl = environment.wsUrl || 'ws://127.0.0.1:8000/ws';
  private readonly apiUrl = `${environment.apiUrl}/users/presence/`;

  // Set of online user IDs maintained via real-time WebSocket events
  readonly onlineUserIds = signal<Set<number>>(new Set());
  readonly isConnected = signal<boolean>(false);

  private socket: WebSocket | null = null;
  private reconnectTimer: any = null;
  private shouldReconnect = true;

  ngOnDestroy(): void {
    this.disconnect();
  }

  /**
   * Connect to global presence WebSocket to receive real-time online/offline updates.
   */
  connect(): void {
    if (!isPlatformBrowser(this.platformId) || typeof WebSocket === 'undefined') {
      return;
    }

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return;
    }

    this.disconnect();
    this.shouldReconnect = true;

    const token = this.authService.getAccessToken();
    if (!token) {
      return;
    }

    const wsUrl = `${this.wsBaseUrl}/presence/?token=${encodeURIComponent(token)}`;

    try {
      this.socket = new WebSocket(wsUrl);

      this.socket.onopen = () => {
        this.isConnected.set(true);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'presence_state' && Array.isArray(data.online_user_ids)) {
            const numSet = new Set<number>(data.online_user_ids.map((id: any) => Number(id)));
            this.onlineUserIds.set(numSet);
          } else if (data.type === 'presence_update') {
            this.handlePresenceUpdate(data as PresenceUpdate);
          }
        } catch {
          // Ignore invalid frames
        }
      };

      this.socket.onclose = () => {
        this.isConnected.set(false);
        this.socket = null;
        if (this.shouldReconnect) {
          this.reconnectTimer = setTimeout(() => {
            if (this.shouldReconnect && this.authService.isAuthenticated()) {
              this.connect();
            }
          }, 4000);
        }
      };

      this.socket.onerror = () => {
        this.isConnected.set(false);
      };
    } catch {
      this.isConnected.set(false);
    }
  }

  /**
   * Disconnect and clean up presence WebSocket.
   */
  disconnect(): void {
    this.shouldReconnect = false;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.socket) {
      try {
        this.socket.close();
      } catch {}
      this.socket = null;
    }
    this.isConnected.set(false);
  }

  /**
   * Check if a given user is currently online.
   */
  isUserOnline(userId?: number | null): boolean {
    if (userId == null) return false;
    return this.onlineUserIds().has(Number(userId));
  }

  /**
   * Query backend REST API for presence status of specific users.
   */
  fetchPresence(userIds?: number[]): Observable<UserPresenceStatus[]> {
    let params = new HttpParams();
    if (userIds && userIds.length > 0) {
      params = params.set('user_ids', userIds.join(','));
    }

    return this.http.get<UserPresenceStatus[]>(this.apiUrl, { params }).pipe(
      tap((results) => {
        const currentSet = new Set(this.onlineUserIds());
        results.forEach((r) => {
          if (r.is_online) {
            currentSet.add(Number(r.user_id));
          } else {
            currentSet.delete(Number(r.user_id));
          }
        });
        this.onlineUserIds.set(currentSet);
      }),
      catchError(() => of([]))
    );
  }

  private handlePresenceUpdate(update: PresenceUpdate): void {
    const uid = Number(update.user_id);
    const set = new Set(this.onlineUserIds());
    if (update.status === 'online') {
      set.add(uid);
    } else {
      set.delete(uid);
    }
    this.onlineUserIds.set(set);
  }
}
