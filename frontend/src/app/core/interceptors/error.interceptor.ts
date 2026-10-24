import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AlertService } from '../services/alert.service';

let isRefreshing = false;
let refreshTokenSubject = new BehaviorSubject<string | null>(null);

export function resetInterceptorRefreshState(): void {
  isRefreshing = false;
  refreshTokenSubject = new BehaviorSubject<string | null>(null);
}

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const alertService = inject(AlertService);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        // If the 401 came from the refresh token endpoint itself
        if (req.url.includes('/auth/token/refresh/')) {
          resetInterceptorRefreshState();
          authService.clearSession();
          alertService.showWarning('Your session has expired. Please sign in again.');
          router.navigate(['/login']);
          return throwError(() => error);
        }

        // If the 401 came from login or register, pass through to component handler
        if (req.url.includes('/auth/login/') || req.url.includes('/auth/register/')) {
          return throwError(() => error);
        }

        // If no refresh token exists at all, clear session and redirect
        if (!authService.getRefreshToken()) {
          authService.clearSession();
          alertService.showWarning('Your session has expired. Please sign in again.');
          router.navigate(['/login']);
          return throwError(() => error);
        }

        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return authService.refreshToken().pipe(
            switchMap((tokens) => {
              isRefreshing = false;
              refreshTokenSubject.next(tokens.access);
              return next(
                req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${tokens.access}`
                  }
                })
              );
            }),
            catchError((refreshErr) => {
              resetInterceptorRefreshState();
              authService.clearSession();
              alertService.showWarning('Your session has expired. Please sign in again.');
              router.navigate(['/login']);
              return throwError(() => refreshErr);
            })
          );
        } else {
          return refreshTokenSubject.pipe(
            filter((token): token is string => token !== null),
            take(1),
            switchMap((token) => {
              return next(
                req.clone({
                  setHeaders: {
                    Authorization: `Bearer ${token}`
                  }
                })
              );
            })
          );
        }
      }

      return throwError(() => error);
    })
  );
};
