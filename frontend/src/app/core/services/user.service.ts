import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { User, UserProfileUpdateRequest } from '../models/user.model';
import { AuthService } from './auth.service';

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly apiUrl = `${environment.apiUrl}/users`;

  getProfile(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me/`).pipe(
      tap((user) => {
        this.authService.currentUser.set(user);
      })
    );
  }

  updateProfile(data: UserProfileUpdateRequest): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/me/`, data).pipe(
      tap((user) => {
        this.authService.currentUser.set(user);
      })
    );
  }

  getUsers(params?: { search?: string; page?: number; page_size?: number }): Observable<PaginatedResponse<User>> {
    let httpParams = new HttpParams();
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.page_size) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }
    return this.http.get<PaginatedResponse<User>>(`${this.apiUrl}/`, { params: httpParams });
  }
}
