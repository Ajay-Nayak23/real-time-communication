import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { CallHistoryResponse, CallRecord } from '../models/call.model';

@Injectable({
  providedIn: 'root',
})
export class CallService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/calls`;

  /**
   * Fetch paginated call history records for the current user.
   */
  getCallHistory(params?: {
    call_type?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }): Observable<CallHistoryResponse> {
    let httpParams = new HttpParams();

    if (params?.call_type) {
      httpParams = httpParams.set('call_type', params.call_type);
    }
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', params.page.toString());
    }
    if (params?.page_size) {
      httpParams = httpParams.set('page_size', params.page_size.toString());
    }

    return this.http.get<CallHistoryResponse>(`${this.apiUrl}/history/`, {
      params: httpParams,
    });
  }

  /**
   * Fetch a single call record by ID.
   */
  getCallDetail(id: number): Observable<CallRecord> {
    return this.http.get<CallRecord>(`${this.apiUrl}/${id}/`);
  }
}
