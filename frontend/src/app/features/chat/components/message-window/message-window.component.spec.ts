import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MessageWindowComponent } from './message-window.component';
import { Conversation } from '../../../../core/models/chat.model';

describe('MessageWindowComponent', () => {
  let component: MessageWindowComponent;
  let fixture: ComponentFixture<MessageWindowComponent>;

  const mockConv: Conversation = {
    id: 1,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:00:00Z',
    unread_count: 0,
    participants: [],
    other_participant: {
      id: 2,
      email: 'partner@example.com',
      name: 'Partner User',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MessageWindowComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(MessageWindowComponent);
    component = fixture.componentInstance;
    component.conversation = mockConv;
    fixture.detectChanges();
  });

  it('should create and render partner header', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.header-name')?.textContent).toContain('Partner User');
  });

  it('should emit startAudioCall on call button click', () => {
    const callSpy = vi.spyOn(component.startAudioCall, 'emit');
    const callBtn = fixture.nativeElement.querySelector('.btn-header-call') as HTMLButtonElement;
    expect(callBtn).toBeTruthy();
    callBtn.click();
    expect(callSpy).toHaveBeenCalled();
  });

  it('should format message timestamps', () => {
    const time = component.formatTime('2026-10-24T14:30:00Z');
    expect(time).toBeTruthy();
  });
});
