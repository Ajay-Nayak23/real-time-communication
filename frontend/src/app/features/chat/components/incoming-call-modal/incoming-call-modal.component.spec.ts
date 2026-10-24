import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IncomingCallModalComponent } from './incoming-call-modal.component';

describe('IncomingCallModalComponent', () => {
  let component: IncomingCallModalComponent;
  let fixture: ComponentFixture<IncomingCallModalComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [IncomingCallModalComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(IncomingCallModalComponent);
    component = fixture.componentInstance;
    component.callerName = 'Alice Wonder';
    component.callType = 'audio';
    fixture.detectChanges();
  });

  it('should create and render caller name', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.caller-name')?.textContent).toContain('Alice Wonder');
    expect(compiled.querySelector('.call-badge')?.textContent).toContain('Incoming Audio Call');
  });

  it('should emit accepted event on accept button click', () => {
    const acceptSpy = vi.spyOn(component.accepted, 'emit');
    const acceptBtn = fixture.nativeElement.querySelector('.btn-accept') as HTMLButtonElement;
    acceptBtn.click();
    expect(acceptSpy).toHaveBeenCalled();
  });

  it('should emit rejected event on decline button click', () => {
    const rejectSpy = vi.spyOn(component.rejected, 'emit');
    const declineBtn = fixture.nativeElement.querySelector('.btn-decline') as HTMLButtonElement;
    declineBtn.click();
    expect(rejectSpy).toHaveBeenCalled();
  });

  it('should handle keyboard Enter to accept and Escape to decline', () => {
    const acceptSpy = vi.spyOn(component.accepted, 'emit');
    const rejectSpy = vi.spyOn(component.rejected, 'emit');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(acceptSpy).toHaveBeenCalled();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(rejectSpy).toHaveBeenCalled();
  });

  it('should format initials accurately', () => {
    expect(component.getInitials('Alice Wonder')).toBe('AW');
    expect(component.getInitials('SingleName')).toBe('SI');
  });
});
