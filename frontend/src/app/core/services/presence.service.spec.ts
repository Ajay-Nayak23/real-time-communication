import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PresenceService } from './presence.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

describe('PresenceService', () => {
  let service: PresenceService;
  let httpTesting: HttpTestingController;
  let authServiceSpy: any;

  beforeEach(() => {
    authServiceSpy = {
      getAccessToken: vi.fn().mockReturnValue('mock-jwt-token'),
      isAuthenticated: vi.fn().mockReturnValue(true),
    };

    TestBed.configureTestingModule({
      providers: [
        PresenceService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthService, useValue: authServiceSpy },
      ],
    });

    service = TestBed.inject(PresenceService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    service.disconnect();
    httpTesting.verify();
  });

  it('should be created and have empty online users set initially', () => {
    expect(service).toBeTruthy();
    expect(service.onlineUserIds().size).toBe(0);
    expect(service.isUserOnline(1)).toBe(false);
  });

  it('should fetch presence status via REST API', () => {
    service.fetchPresence([1, 2]).subscribe((statuses) => {
      expect(statuses.length).toBe(2);
      expect(service.isUserOnline(1)).toBe(true);
      expect(service.isUserOnline(2)).toBe(false);
    });

    const req = httpTesting.expectOne((r) => r.url.includes('/users/presence/'));
    expect(req.request.method).toBe('GET');
    req.flush([
      { user_id: 1, is_online: true, last_seen: null },
      { user_id: 2, is_online: false, last_seen: '2026-10-25T01:00:00Z' },
    ]);
  });

  it('should correctly report user online status when set is updated', () => {
    service.onlineUserIds.set(new Set([10, 20]));
    expect(service.isUserOnline(10)).toBe(true);
    expect(service.isUserOnline(20)).toBe(true);
    expect(service.isUserOnline(30)).toBe(false);
    expect(service.isUserOnline(null)).toBe(false);
  });
});
