import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-message-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <form class="message-composer" (ngSubmit)="onSubmit()" role="form" aria-label="Message composer">
      <div class="input-wrapper">
        <textarea
          class="message-textarea"
          [(ngModel)]="content"
          name="messageContent"
          placeholder="Type a message... (Press Enter to send, Shift+Enter for new line)"
          rows="1"
          (keydown.enter)="onEnterKey($event)"
          [disabled]="disabled"
          aria-label="Message text"
        ></textarea>
      </div>

      <button
        type="submit"
        class="btn-send"
        [disabled]="disabled || !canSubmit"
        title="Send message"
        aria-label="Send message"
      >
        @if (disabled) {
          <span class="spinner"></span>
        } @else {
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        }
      </button>
    </form>
  `,
  styles: [`
    .message-composer {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.85rem 1.25rem;
      background: rgba(15, 23, 42, 0.85);
      backdrop-filter: blur(20px);
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }

    .input-wrapper {
      flex: 1;
      position: relative;
    }

    .message-textarea {
      width: 100%;
      min-height: 42px;
      max-height: 120px;
      padding: 0.65rem 1rem;
      background: rgba(30, 41, 59, 0.7);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #f8fafc;
      font-size: 0.95rem;
      font-family: inherit;
      resize: none;
      outline: none;
      line-height: 1.4;
      transition: all 0.2s ease;

      &::placeholder {
        color: #64748b;
      }

      &:focus {
        border-color: #3b82f6;
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        background: rgba(30, 41, 59, 0.95);
      }

      &:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }

    .btn-send {
      width: 42px;
      height: 42px;
      border-radius: 12px;
      background: linear-gradient(135deg, #3b82f6, #6366f1);
      border: none;
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      flex-shrink: 0;
      transition: all 0.2s ease;
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);

      &:hover:not(:disabled) {
        transform: translateY(-1px) scale(1.03);
        box-shadow: 0 6px 16px rgba(59, 130, 246, 0.45);
      }

      &:active:not(:disabled) {
        transform: translateY(0) scale(0.98);
      }

      &:disabled {
        opacity: 0.45;
        cursor: not-allowed;
        box-shadow: none;
      }
    }

    .spinner {
      width: 18px;
      height: 18px;
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-top-color: #ffffff;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
  `],
})
export class MessageInputComponent {
  @Input() disabled = false;
  @Output() messageSent = new EventEmitter<string>();

  content = '';

  get canSubmit(): boolean {
    return this.content.trim().length > 0;
  }

  onEnterKey(event: Event): void {
    const keyboardEvent = event as KeyboardEvent;
    if (!keyboardEvent.shiftKey) {
      keyboardEvent.preventDefault();
      this.onSubmit();
    }
  }

  onSubmit(): void {
    const trimmed = this.content.trim();
    if (trimmed && !this.disabled) {
      this.messageSent.emit(trimmed);
      this.content = '';
    }
  }
}
