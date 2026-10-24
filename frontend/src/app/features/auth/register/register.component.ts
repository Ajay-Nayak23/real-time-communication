import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

function passwordMatchValidator(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirmPassword = control.get('confirmPassword')?.value;
  if (password && confirmPassword && password !== confirmPassword) {
    return { passwordMismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  readonly isLoading = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly registerForm = this.fb.nonNullable.group(
    {
      name: ['', [Validators.required, Validators.maxLength(150)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', [Validators.required]]
    },
    { validators: [passwordMatchValidator] }
  );

  onSubmit(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const { name, email, password } = this.registerForm.getRawValue();

    this.authService.register({ name, email, password }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.successMessage.set('Account created successfully! Signing you in...');

        // Automatically log in after registration
        this.authService.login({ email, password }).subscribe({
          next: () => {
            this.router.navigate(['/']);
          },
          error: () => {
            this.router.navigate(['/login']);
          }
        });
      },
      error: (err) => {
        this.isLoading.set(false);
        const emailErr = err.error?.email?.[0];
        const passErr = err.error?.password?.[0];
        const nameErr = err.error?.name?.[0];
        const detail = emailErr || passErr || nameErr || err.error?.detail || 'Registration failed. Please check your details.';
        this.errorMessage.set(detail);
      }
    });
  }
}
