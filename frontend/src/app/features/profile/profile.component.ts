import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { UserService } from '../../core/services/user.service';
import { AlertService } from '../../core/services/alert.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  template: `
    <div class="profile-container">
      <div class="profile-card">
        <div class="profile-header">
          <div class="avatar-large">
            {{ userInitial }}
          </div>
          <h2>{{ authService.currentUser()?.name || 'User Profile' }}</h2>
          <span class="email-badge">{{ authService.currentUser()?.email }}</span>
        </div>

        @if (!isEditing()) {
          <div class="profile-details">
            <div class="detail-item">
              <span class="label">User ID</span>
              <span class="value">#{{ authService.currentUser()?.id }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Display Name</span>
              <span class="value">{{ authService.currentUser()?.name || 'Not set' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Bio</span>
              <span class="value">{{ authService.currentUser()?.bio || 'No bio provided' }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Email Address</span>
              <span class="value">{{ authService.currentUser()?.email }}</span>
            </div>
            <div class="detail-item">
              <span class="label">Account Status</span>
              <span class="value status-active">Active</span>
            </div>
          </div>

          <div class="profile-actions">
            <button class="btn btn-secondary" (click)="enableEdit()">Edit Profile</button>
            <a routerLink="/chat" class="btn btn-primary">Back to Messages</a>
          </div>
        } @else {
          <form [formGroup]="editForm" (ngSubmit)="saveProfile()" class="edit-form">
            <div class="form-group">
              <label for="name">Display Name</label>
              <input id="name" type="text" formControlName="name" placeholder="Your name" />
            </div>

            <div class="form-group">
              <label for="bio">Bio</label>
              <textarea id="bio" rows="3" formControlName="bio" placeholder="Tell others a bit about yourself"></textarea>
            </div>

            <div class="profile-actions">
              <button type="button" class="btn btn-cancel" (click)="cancelEdit()" [disabled]="isSaving()">Cancel</button>
              <button type="submit" class="btn btn-primary" [disabled]="editForm.invalid || isSaving()">
                {{ isSaving() ? 'Saving...' : 'Save Changes' }}
              </button>
            </div>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    .profile-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: calc(100vh - 180px);
      padding: 2rem 1rem;
    }
    .profile-card {
      background: rgba(30, 41, 59, 0.7);
      backdrop-filter: blur(16px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 2.5rem;
      max-width: 500px;
      width: 100%;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
    }
    .profile-header {
      text-align: center;
      margin-bottom: 2rem;
    }
    .avatar-large {
      width: 80px;
      height: 80px;
      margin: 0 auto 1rem auto;
      border-radius: 50%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      color: white;
      box-shadow: 0 8px 16px rgba(59, 130, 246, 0.3);
    }
    h2 {
      margin: 0 0 0.5rem 0;
      color: #f8fafc;
      font-size: 1.5rem;
    }
    .email-badge {
      color: #94a3b8;
      font-size: 0.9rem;
      background: rgba(255, 255, 255, 0.05);
      padding: 0.25rem 0.75rem;
      border-radius: 20px;
    }
    .profile-details {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      margin-bottom: 2rem;
      background: rgba(15, 23, 42, 0.6);
      padding: 1.25rem;
      border-radius: 12px;
      border: 1px solid rgba(255, 255, 255, 0.05);
    }
    .detail-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 0.9rem;
    }
    .label {
      color: #94a3b8;
    }
    .value {
      color: #f1f5f9;
      font-weight: 500;
      text-align: right;
      max-width: 60%;
    }
    .status-active {
      color: #34d399;
      font-weight: 600;
    }
    .profile-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }
    .edit-form {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      margin-bottom: 1rem;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      label {
        color: #94a3b8;
        font-size: 0.85rem;
        font-weight: 500;
      }
      input, textarea {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 0.75rem;
        color: #f8fafc;
        font-family: inherit;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s;
        &:focus {
          border-color: #3b82f6;
        }
      }
    }
    .btn {
      display: inline-flex;
      align-items: center;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      border: none;
      font-size: 0.9rem;
    }
    .btn-primary {
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      color: white;
      &:hover:not(:disabled) {
        background: linear-gradient(135deg, #2563eb, #1d4ed8);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
      }
      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    .btn-secondary {
      background: rgba(51, 65, 85, 0.8);
      color: #f1f5f9;
      &:hover {
        background: rgba(71, 85, 105, 0.9);
      }
    }
    .btn-cancel {
      background: transparent;
      color: #94a3b8;
      border: 1px solid rgba(255, 255, 255, 0.1);
      &:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #f8fafc;
      }
    }
  `]
})
export class ProfileComponent implements OnInit {
  readonly authService = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly alertService = inject(AlertService);
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isEditing = signal<boolean>(false);
  readonly isSaving = signal<boolean>(false);

  readonly editForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
    bio: ['']
  });

  get userInitial(): string {
    const user = this.authService.currentUser();
    const name = user?.name || user?.email || 'U';
    return name.charAt(0).toUpperCase();
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId) && this.authService.isAuthenticated()) {
      this.userService.getProfile().subscribe({
        next: (user) => {
          this.editForm.patchValue({
            name: user.name || '',
            bio: user.bio || ''
          });
        },
        error: () => {
          // If profile fetch fails, existing session details remain intact
        }
      });
    }
  }

  enableEdit(): void {
    const current = this.authService.currentUser();
    this.editForm.setValue({
      name: current?.name || '',
      bio: current?.bio || ''
    });
    this.isEditing.set(true);
  }

  cancelEdit(): void {
    this.isEditing.set(false);
  }

  saveProfile(): void {
    if (this.editForm.invalid) {
      return;
    }

    this.isSaving.set(true);
    const { name, bio } = this.editForm.getRawValue();

    this.userService.updateProfile({ name, bio }).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.isEditing.set(false);
        this.alertService.showSuccess('Profile updated successfully!');
      },
      error: () => {
        this.isSaving.set(false);
        this.alertService.showError('Failed to update profile. Please try again.');
      }
    });
  }
}
