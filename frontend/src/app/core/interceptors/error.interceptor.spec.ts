import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { errorInterceptor, resetInterceptorRefreshState } from './error.interceptor';
import { AuthService } from '../services/auth.service';
import { AlertService } from '../services/alert.service';

describe('errorInterceptor', () => {
  let httpClient: HttpClient;
  let httpTesting: HttpTestingController;
  let authServiceSpy: {
    getRefreshToken: ReturnType<typeof vi.fn>;
    refreshToken: ReturnType<typeof vi.fn>;
    clearSession: ReturnType<typeof vi.fn>;
  };
  let alertServiceSpy: {
    showWarning: ReturnType<typeof vi.fn>;
    showError: ReturnType<typeof vi.fn>;
  };
  let routerSpy: {
    navigate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    resetInterceptorRefreshState();

    authServiceSpy = {
      getRefreshToken: vi.fn().mockReturnValue('mock-refresh-token'),
      refreshToken: vi.fn(),
      clearSession: vi.fn()
    };
    alertServiceSpy = {
      showWarning: vi.fn(),
      showError: vi.fn()
    };
    routerSpy = {
      navigate: vi.fn()
    };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor])),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
        { provide: AlertService, useValue: alertServiceSpy },
        { provide: Router, useValue: routerSpy }
      ]
    });

    httpClient = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
    resetInterceptorRefreshState();
  });

  it('should pass through successful responses', () => {
    let responseData: any = null;
    httpClient.get('/api/test/').subscribe((res) => {
      responseData = res;
    });

    const req = httpTesting.expectOne('/api/test/');
    req.flush({ message: 'success' });

    expect(responseData).toEqual({ message: 'success' });
  });

  it('should attempt token refresh on 401 and retry request with new token', () => {
    authServiceSpy.refreshToken.mockReturnValue(of({ access: 'new-access-token' }));

    let responseData: any = null;
    httpClient.get('/api/protected/').subscribe((res) => {
      responseData = res;
    });

    // First request responds 401
    const req1 = httpTesting.expectOne('/api/protected/');
    req1.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.refreshToken).toHaveBeenCalled();

    // Retried request with new access token
    const req2 = httpTesting.expectOne('/api/protected/');
    expect(req2.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    req2.flush({ data: 'secret' });

    expect(responseData).toEqual({ data: 'secret' });
  });

  it('should clear session and redirect to login if token refresh fails', () => {
    authServiceSpy.refreshToken.mockReturnValue(throwError(() => new Error('Invalid refresh token')));

    let errorReceived: any = null;
    httpClient.get('/api/protected/').subscribe({
      next: () => {},
      error: (err) => {
        errorReceived = err;
      }
    });

    const req = httpTesting.expectOne('/api/protected/');
    req.flush('Unauthorized', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.clearSession).toHaveBeenCalled();
    expect(alertServiceSpy.showWarning).toHaveBeenCalledWith('Your session has expired. Please sign in again.');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    expect(errorReceived).toBeTruthy();
  });

  it('should clear session and redirect to login if 401 occurs on refresh endpoint itself', () => {
    let errorReceived: any = null;
    httpClient.post('/api/auth/token/refresh/', {}).subscribe({
      next: () => {},
      error: (err) => {
        errorReceived = err;
      }
    });

    const req = httpTesting.expectOne('/api/auth/token/refresh/');
    req.flush('Token blacklisted', { status: 401, statusText: 'Unauthorized' });

    expect(authServiceSpy.clearSession).toHaveBeenCalled();
    expect(alertServiceSpy.showWarning).toHaveBeenCalledWith('Your session has expired. Please sign in again.');
    expect(routerSpy.navigate).toHaveBeenCalledWith(['/login']);
    expect(errorReceived).toBeTruthy();
  });
});
