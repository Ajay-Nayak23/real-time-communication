import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { RegisterComponent } from './register.component';

describe('RegisterComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegisterComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting()
      ]
    }).compileComponents();
  });

  it('should create register component', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;
    expect(component).toBeTruthy();
  });

  it('should invalidate when passwords do not match', () => {
    const fixture = TestBed.createComponent(RegisterComponent);
    const component = fixture.componentInstance;

    component.registerForm.controls.name.setValue('Ajay');
    component.registerForm.controls.email.setValue('ajay@example.com');
    component.registerForm.controls.password.setValue('password123');
    component.registerForm.controls.confirmPassword.setValue('differentPassword');

    expect(component.registerForm.valid).toBe(false);
    expect(component.registerForm.hasError('passwordMismatch')).toBe(true);

    component.registerForm.controls.confirmPassword.setValue('password123');
    expect(component.registerForm.valid).toBe(true);
  });
});
