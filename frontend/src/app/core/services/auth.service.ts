import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, catchError, of, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterRequest, User } from '../models/user.model';

const ACCESS_TOKEN_KEY = 'rtc_access_token';
const REFRESH_TOKEN_KEY = 'rtc_refresh_token';
const USER_KEY = 'rtc_current_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly baseUrl = `${environment.apiUrl}/auth`;

  readonly currentUser = signal<User | null>(this.loadStoredUser());
  readonly isAuthenticated = computed(() => !!this.currentUser());

  register(data: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/register/`, data);
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login/`, credentials).pipe(
      tap((res) => {
        this.storeTokens(res.access, res.refresh);
        this.storeUser(res.user);
        this.currentUser.set(res.user);
      })
    );
  }

  refreshToken(): Observable<{ access: string }> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.clearSession();
      return throwError(() => new Error('No refresh token available'));
    }
    return this.http.post<{ access: string }>(`${this.baseUrl}/token/refresh/`, { refresh }).pipe(
      tap((res) => {
        if (res.access) {
          this.storeAccessToken(res.access);
        }
      }),
      catchError((err) => {
        this.clearSession();
        throw err;
      })
    );
  }

  logout(): Observable<any> {
    const refresh = this.getRefreshToken();
    const request$ = refresh
      ? this.http.post(`${this.baseUrl}/logout/`, { refresh }).pipe(catchError(() => of(null)))
      : of(null);

    return request$.pipe(
      tap(() => {
        this.clearSession();
      })
    );
  }

  getAccessToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(ACCESS_TOKEN_KEY);
    }
    return null;
  }

  getRefreshToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(REFRESH_TOKEN_KEY);
    }
    return null;
  }

  private storeTokens(access: string, refresh: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access);
      localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
    }
  }

  private storeAccessToken(access: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(ACCESS_TOKEN_KEY, access);
    }
  }

  private storeUser(user: User): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
  }

  private loadStoredUser(): User | null {
    if (isPlatformBrowser(this.platformId)) {
      const data = localStorage.getItem(USER_KEY);
      if (data) {
        try {
          return JSON.parse(data) as User;
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  clearSession(): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(ACCESS_TOKEN_KEY);
      localStorage.removeItem(REFRESH_TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    this.currentUser.set(null);
  }
}
