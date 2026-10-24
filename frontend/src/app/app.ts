import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { StatusIndicatorComponent } from './shared/components/status-indicator/status-indicator.component';
import { AuthService } from './core/services/auth.service';
import { AlertService } from './core/services/alert.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, StatusIndicatorComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  readonly authService = inject(AuthService);
  readonly alertService = inject(AlertService);
  private readonly router = inject(Router);

  protected readonly title = signal('Real-Time Communication Platform');

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}
