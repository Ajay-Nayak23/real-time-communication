import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ProfileComponent } from './profile.component';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';

describe('ProfileComponent', () => {
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProfileComponent],
      providers: [
        AuthService,
        UserService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    authService.currentUser.set({
      id: 1,
      email: 'profile@example.com',
      name: 'Test Profile User',
      bio: 'Coding away'
    });
  });

  it('should create profile component', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should render user display name and email', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h2')?.textContent).toContain('Test Profile User');
    expect(compiled.querySelector('.email-badge')?.textContent).toContain('profile@example.com');
  });

  it('should switch to edit mode when enableEdit is called', () => {
    const fixture = TestBed.createComponent(ProfileComponent);
    const component = fixture.componentInstance;
    expect(component.isEditing()).toBe(false);

    component.enableEdit();
    expect(component.isEditing()).toBe(true);
    expect(component.editForm.value.name).toBe('Test Profile User');
    expect(component.editForm.value.bio).toBe('Coding away');
  });
});
