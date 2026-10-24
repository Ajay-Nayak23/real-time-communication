import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface HealthResponse {
  status: string;
}

export interface BackendStatus {
  isConnected: boolean;
  status: string;
  checkedAt: Date;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/health/`;

  checkHealth(): Observable<BackendStatus> {
    return this.http.get<HealthResponse>(this.apiUrl).pipe(
      map((res) => ({
        isConnected: res.status === 'ok',
        status: res.status,
        checkedAt: new Date()
      })),
      catchError((err) =>
        of({
          isConnected: false,
          status: 'disconnected',
          checkedAt: new Date(),
          error: err.statusText || 'Backend unreachable'
        })
      )
    );
  }
}
