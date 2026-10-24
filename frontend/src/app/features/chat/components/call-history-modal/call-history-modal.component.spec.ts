import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { CallHistoryModalComponent } from './call-history-modal.component';
import { CallService } from '../../../../core/services/call.service';
import { CallRecord } from '../../../../core/models/call.model';

describe('CallHistoryModalComponent', () => {
  let component: CallHistoryModalComponent;
  let fixture: ComponentFixture<CallHistoryModalComponent>;
  let mockCallService: any;

  const mockUser1 = { id: 1, email: 'alice@example.com', name: 'Alice' };
  const mockUser2 = { id: 2, email: 'bob@example.com', name: 'Bob' };

  const mockCall: CallRecord = {
    id: 99,
    uuid: 'call-uuid-99',
    caller: mockUser1,
    callee: mockUser2,
    other_participant: mockUser2,
    call_type: 'audio',
    status: 'ended',
    duration: 75,
    created_at: '2026-10-24T20:00:00Z',
  };

  beforeEach(async () => {
    mockCallService = {
      getCallHistory: vi.fn().mockReturnValue(of({ count: 1, results: [mockCall] })),
    };

    await TestBed.configureTestingModule({
      imports: [CallHistoryModalComponent],
      providers: [
        { provide: CallService, useValue: mockCallService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(CallHistoryModalComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create and fetch call history', () => {
    expect(component).toBeTruthy();
    expect(mockCallService.getCallHistory).toHaveBeenCalled();
    expect(component.calls().length).toBe(1);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.call-partner')?.textContent).toContain('Bob');
    expect(compiled.querySelector('.status-badge')?.textContent).toContain('ended');
    expect(compiled.querySelector('.duration')?.textContent).toContain('1m 15s');
  });

  it('should emit callRequested and close when clicking call button', () => {
    const callSpy = vi.spyOn(component.callRequested, 'emit');
    const closeSpy = vi.spyOn(component.close, 'emit');

    const callBtn = fixture.nativeElement.querySelector('.btn-call-back') as HTMLButtonElement;
    callBtn.click();

    expect(callSpy).toHaveBeenCalledWith(mockUser2);
    expect(closeSpy).toHaveBeenCalled();
  });

  it('should format duration and initials accurately', () => {
    expect(component.formatDuration(45)).toBe('45s');
    expect(component.formatDuration(130)).toBe('2m 10s');
    expect(component.getInitials(mockUser2)).toBe('BO');
  });
});
