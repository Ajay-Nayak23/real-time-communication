import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { UserService } from './user.service';
import { AuthService } from './auth.service';
import { User } from '../models/user.model';

describe('UserService', () => {
  let service: UserService;
  let httpTesting: HttpTestingController;
  let authService: AuthService;

  const mockUser: User = {
    id: 1,
    email: 'user@example.com',
    name: 'Test User',
    bio: 'Software engineer',
    profile_image: 'https://example.com/avatar.jpg'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        UserService,
        AuthService,
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    });

    service = TestBed.inject(UserService);
    httpTesting = TestBed.inject(HttpTestingController);
    authService = TestBed.inject(AuthService);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should get current user profile via GET /api/users/me/', () => {
    service.getProfile().subscribe((user) => {
      expect(user).toEqual(mockUser);
      expect(authService.currentUser()).toEqual(mockUser);
    });

    const req = httpTesting.expectOne('http://127.0.0.1:8000/api/users/me/');
    expect(req.request.method).toBe('GET');
    req.flush(mockUser);
  });

  it('should update user profile via PATCH /api/users/me/', () => {
    const updatedUser = { ...mockUser, name: 'New Name', bio: 'Updated bio' };

    service.updateProfile({ name: 'New Name', bio: 'Updated bio' }).subscribe((user) => {
      expect(user.name).toBe('New Name');
      expect(user.bio).toBe('Updated bio');
      expect(authService.currentUser()?.name).toBe('New Name');
    });

    const req = httpTesting.expectOne('http://127.0.0.1:8000/api/users/me/');
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ name: 'New Name', bio: 'Updated bio' });
    req.flush(updatedUser);
  });

  it('should get users directory via GET /api/users/ with search params', () => {
    const mockDirectoryResponse = {
      count: 1,
      next: null,
      previous: null,
      results: [mockUser]
    };

    service.getUsers({ search: 'alice', page: 1, page_size: 10 }).subscribe((res) => {
      expect(res.count).toBe(1);
      expect(res.results.length).toBe(1);
      expect(res.results[0]).toEqual(mockUser);
    });

    const req = httpTesting.expectOne('http://127.0.0.1:8000/api/users/?search=alice&page=1&page_size=10');
    expect(req.request.method).toBe('GET');
    req.flush(mockDirectoryResponse);
  });
});
