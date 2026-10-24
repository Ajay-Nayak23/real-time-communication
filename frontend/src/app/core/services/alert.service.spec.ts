import { TestBed } from '@angular/core/testing';
import { AlertService } from './alert.service';

describe('AlertService', () => {
  let service: AlertService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AlertService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(service.alert()).toBeNull();
  });

  it('should set an alert when showError is called', () => {
    service.showError('Something went wrong');
    const current = service.alert();
    expect(current).not.toBeNull();
    expect(current?.message).toBe('Something went wrong');
    expect(current?.type).toBe('error');
  });

  it('should set an alert when showWarning is called', () => {
    service.showWarning('Session expired');
    const current = service.alert();
    expect(current).not.toBeNull();
    expect(current?.message).toBe('Session expired');
    expect(current?.type).toBe('warning');
  });

  it('should clear active alert', () => {
    service.showSuccess('Done');
    expect(service.alert()).not.toBeNull();
    service.clear();
    expect(service.alert()).toBeNull();
  });
});
