import { Injectable, signal } from '@angular/core';

export type AlertType = 'error' | 'warning' | 'success' | 'info';

export interface AlertMessage {
  id: number;
  message: string;
  type: AlertType;
}

@Injectable({
  providedIn: 'root'
})
export class AlertService {
  private currentTimeout: any = null;
  private counter = 0;

  readonly alert = signal<AlertMessage | null>(null);

  show(message: string, type: AlertType = 'info', duration: number = 5000): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }

    const id = ++this.counter;
    this.alert.set({ id, message, type });

    if (duration > 0) {
      this.currentTimeout = setTimeout(() => {
        if (this.alert()?.id === id) {
          this.clear();
        }
      }, duration);
    }
  }

  showError(message: string, duration: number = 6000): void {
    this.show(message, 'error', duration);
  }

  showWarning(message: string, duration: number = 6000): void {
    this.show(message, 'warning', duration);
  }

  showSuccess(message: string, duration: number = 4000): void {
    this.show(message, 'success', duration);
  }

  showInfo(message: string, duration: number = 4000): void {
    this.show(message, 'info', duration);
  }

  clear(): void {
    if (this.currentTimeout) {
      clearTimeout(this.currentTimeout);
      this.currentTimeout = null;
    }
    this.alert.set(null);
  }
}
