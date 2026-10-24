import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActiveCallOverlayComponent } from './active-call-overlay.component';

describe('ActiveCallOverlayComponent', () => {
  let component: ActiveCallOverlayComponent;
  let fixture: ComponentFixture<ActiveCallOverlayComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActiveCallOverlayComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ActiveCallOverlayComponent);
    component = fixture.componentInstance;
    component.partnerName = 'Bob Builder';
    component.callState = 'calling';
    fixture.detectChanges();
  });

  it('should create and render partner name and calling status', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.partner-name')?.textContent).toContain('Bob Builder');
    expect(compiled.querySelector('.calling-text')?.textContent).toContain('Calling...');
  });

  it('should display timer and visualizer when connected', () => {
    const connFixture = TestBed.createComponent(ActiveCallOverlayComponent);
    const connComp = connFixture.componentInstance;
    connComp.partnerName = 'Bob Builder';
    connComp.callState = 'connected';
    connFixture.detectChanges();

    connComp.durationSeconds.set(65); // 01:05
    connFixture.detectChanges();

    const compiled = connFixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.timer-text')?.textContent).toBe('01:05');
    expect(compiled.querySelector('.visualizer-wave')).toBeTruthy();
  });

  it('should emit toggleMute on mute button click', () => {
    const muteSpy = vi.spyOn(component.toggleMute, 'emit');
    const muteBtn = fixture.nativeElement.querySelector('.btn-mute') as HTMLButtonElement;
    muteBtn.click();
    expect(muteSpy).toHaveBeenCalled();
  });

  it('should emit endCall on end call button click', () => {
    const endSpy = vi.spyOn(component.endCall, 'emit');
    const endBtn = fixture.nativeElement.querySelector('.btn-end-call') as HTMLButtonElement;
    endBtn.click();
    expect(endSpy).toHaveBeenCalled();
  });

  it('should format duration MM:SS correctly', () => {
    component.durationSeconds.set(0);
    expect(component.formattedDuration()).toBe('00:00');
    component.durationSeconds.set(45);
    expect(component.formattedDuration()).toBe('00:45');
    component.durationSeconds.set(125);
    expect(component.formattedDuration()).toBe('02:05');
  });
});
