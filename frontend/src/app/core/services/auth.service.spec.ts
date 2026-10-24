import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('AuthService', () => {
  let service: AuthService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });
    service = TestBed.inject(AuthService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    localStorage.clear();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should login and store tokens and user in session', () => {
    const mockResponse = {
      access: 'mock-access-token',
      refresh: 'mock-refresh-token',
      user: {
        id: 1,
        email: 'user@example.com',
        name: 'Test User'
      }
    };

    service.login({ email: 'user@example.com', password: 'Password123!' }).subscribe((res) => {
      expect(res.access).toBe('mock-access-token');
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getAccessToken()).toBe('mock-access-token');
      expect(service.currentUser()?.email).toBe('user@example.com');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/login/`);
    expect(req.request.method).toBe('POST');
    req.flush(mockResponse);
  });

  it('should register a new user', () => {
    const mockUser = {
      id: 2,
      email: 'new@example.com',
      name: 'New User'
    };

    service.register({ email: 'new@example.com', name: 'New User', password: 'Password123!' }).subscribe((res) => {
      expect(res.id).toBe(2);
      expect(res.email).toBe('new@example.com');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/register/`);
    expect(req.request.method).toBe('POST');
    req.flush(mockUser);
  });

  it('should logout and clear stored session', () => {
    // Seed token
    localStorage.setItem('rtc_access_token', 'test-token');
    localStorage.setItem('rtc_refresh_token', 'test-refresh');

    service.logout().subscribe(() => {
      expect(service.getAccessToken()).toBeNull();
      expect(service.currentUser()).toBeNull();
      expect(service.isAuthenticated()).toBe(false);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/auth/logout/`);
    expect(req.request.method).toBe('POST');
    req.flush({ detail: 'Successfully logged out.' });
  });
});
