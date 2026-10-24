import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  let authServiceSpy: { isAuthenticated: () => boolean };
  let router: Router;

  beforeEach(() => {
    authServiceSpy = {
      isAuthenticated: () => false
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: authServiceSpy }
      ]
    });

    router = TestBed.inject(Router);
  });

  it('should allow navigation when authenticated', () => {
    authServiceSpy.isAuthenticated = () => true;
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/chat' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(result).toBe(true);
  });

  it('should redirect to /login with returnUrl when unauthenticated', () => {
    authServiceSpy.isAuthenticated = () => false;
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/chat' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(result instanceof UrlTree).toBe(true);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/login');
    expect(tree.queryParams['returnUrl']).toBe('/chat');
  });
});
