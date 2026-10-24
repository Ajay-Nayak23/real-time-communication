import { TestBed } from '@angular/core/testing';
import { Router, ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree } from '@angular/router';
import { publicGuard } from './public.guard';
import { AuthService } from '../services/auth.service';

describe('publicGuard', () => {
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

  it('should allow navigation when not authenticated', () => {
    authServiceSpy.isAuthenticated = () => false;
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/login' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => publicGuard(route, state));
    expect(result).toBe(true);
  });

  it('should redirect to /chat when user is already authenticated', () => {
    authServiceSpy.isAuthenticated = () => true;
    const route = {} as ActivatedRouteSnapshot;
    const state = { url: '/login' } as RouterStateSnapshot;

    const result = TestBed.runInInjectionContext(() => publicGuard(route, state));
    expect(result instanceof UrlTree).toBe(true);
    const tree = result as UrlTree;
    expect(tree.toString()).toContain('/chat');
  });
});
