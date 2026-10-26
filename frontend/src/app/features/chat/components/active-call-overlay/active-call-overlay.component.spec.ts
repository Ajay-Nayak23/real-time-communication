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
    component.callType = 'audio';
    fixture.detectChanges();
  });

  it('should create and render partner name and calling status in audio mode', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.partner-name')?.textContent).toContain('Bob Builder');
    expect(compiled.querySelector('.calling-text')?.textContent).toContain('Calling...');
    expect(compiled.querySelector('.audio-card')).toBeTruthy();
  });

  it('should display timer and visualizer when connected in audio mode', () => {
    const connFixture = TestBed.createComponent(ActiveCallOverlayComponent);
    const connComp = connFixture.componentInstance;
    connComp.partnerName = 'Bob Builder';
    connComp.callState = 'connected';
    connComp.callType = 'audio';
    connFixture.detectChanges();

    connComp.durationSeconds.set(65); // 01:05
    connFixture.detectChanges();

    const compiled = connFixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.timer-text')?.textContent).toBe('01:05');
    expect(compiled.querySelector('.visualizer-wave')).toBeTruthy();
  });

  it('should render video grid layout when callType is video', () => {
    const videoFixture = TestBed.createComponent(ActiveCallOverlayComponent);
    const videoComp = videoFixture.componentInstance;
    videoComp.partnerName = 'Alice Wonderland';
    videoComp.callState = 'connected';
    videoComp.callType = 'video';
    videoFixture.detectChanges();

    const compiled = videoFixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.video-grid-wrapper')).toBeTruthy();
    expect(compiled.querySelector('.remote-video-element')).toBeTruthy();
    expect(compiled.querySelector('.pip-local-wrapper')).toBeTruthy();
    expect(compiled.querySelector('.local-video-element')).toBeTruthy();
    expect(compiled.querySelector('.video-partner-name')?.textContent).toContain('Alice Wonderland');
  });

  it('should emit toggleMute on mute button click', () => {
    const muteSpy = vi.spyOn(component.toggleMute, 'emit');
    const muteBtn = fixture.nativeElement.querySelector('.btn-mute') as HTMLButtonElement;
    expect(muteBtn).toBeTruthy();
    muteBtn.click();
    expect(muteSpy).toHaveBeenCalled();
  });

  it('should emit endCall on end call button click', () => {
    const endSpy = vi.spyOn(component.endCall, 'emit');
    const endBtn = fixture.nativeElement.querySelector('.btn-end-call') as HTMLButtonElement;
    expect(endBtn).toBeTruthy();
    endBtn.click();
    expect(endSpy).toHaveBeenCalled();
  });

  it('should emit toggleVideo in video mode', () => {
    const videoFixture = TestBed.createComponent(ActiveCallOverlayComponent);
    const videoComp = videoFixture.componentInstance;
    videoComp.callType = 'video';
    videoFixture.detectChanges();

    const videoSpy = vi.spyOn(videoComp.toggleVideo, 'emit');
    const videoBtn = videoFixture.nativeElement.querySelector('.btn-camera') as HTMLButtonElement;
    expect(videoBtn).toBeTruthy();
    videoBtn.click();
    expect(videoSpy).toHaveBeenCalled();
  });

  it('should emit switchCamera in video mode when canSwitchCamera is true', () => {
    const videoFixture = TestBed.createComponent(ActiveCallOverlayComponent);
    const videoComp = videoFixture.componentInstance;
    videoComp.callType = 'video';
    videoComp.canSwitchCamera = true;
    videoFixture.detectChanges();

    const switchSpy = vi.spyOn(videoComp.switchCamera, 'emit');
    const switchBtn = videoFixture.nativeElement.querySelector('.btn-switch') as HTMLButtonElement;
    expect(switchBtn).toBeTruthy();
    switchBtn.click();
    expect(switchSpy).toHaveBeenCalled();
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
