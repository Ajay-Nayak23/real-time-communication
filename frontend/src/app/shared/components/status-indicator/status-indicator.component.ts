import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, DatePipe, isPlatformBrowser } from '@angular/common';
import { HealthService, BackendStatus } from '../../../core/services/health.service';

@Component({
  selector: 'app-status-indicator',
  standalone: true,
  imports: [CommonModule, DatePipe],
  templateUrl: './status-indicator.component.html',
  styleUrl: './status-indicator.component.scss'
})
export class StatusIndicatorComponent implements OnInit {
  private readonly healthService = inject(HealthService);
  private readonly platformId = inject(PLATFORM_ID);

  readonly isLoading = signal<boolean>(false);
  readonly status = signal<BackendStatus | null>(null);

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      this.refresh();
    }
  }

  refresh(): void {
    this.isLoading.set(true);
    this.healthService.checkHealth().subscribe({
      next: (res) => {
        this.status.set(res);
        this.isLoading.set(false);
      },
      error: () => {
        this.status.set({
          isConnected: false,
          status: 'error',
          checkedAt: new Date(),
          error: 'Connection failed'
        });
        this.isLoading.set(false);
      }
    });
  }
}
