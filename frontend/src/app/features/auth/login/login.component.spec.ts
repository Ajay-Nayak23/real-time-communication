import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create login component', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should validate email and password as required', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const component = fixture.componentInstance;
    expect(component.loginForm.valid).toBe(false);

    component.loginForm.controls.email.setValue('invalid-email');
    expect(component.loginForm.controls.email.valid).toBe(false);

    component.loginForm.controls.email.setValue('valid@example.com');
    component.loginForm.controls.password.setValue('short');
    expect(component.loginForm.controls.password.valid).toBe(false);

    component.loginForm.controls.password.setValue('password123');
    expect(component.loginForm.valid).toBe(true);
  });
});
