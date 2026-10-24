import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConversationListComponent } from './conversation-list.component';
import { Conversation } from '../../../../core/models/chat.model';

describe('ConversationListComponent', () => {
  let component: ConversationListComponent;
  let fixture: ComponentFixture<ConversationListComponent>;

  const mockConv: Conversation = {
    id: 1,
    created_at: '2026-10-24T10:00:00Z',
    updated_at: '2026-10-24T10:00:00Z',
    unread_count: 0,
    participants: [],
    other_participant: {
      id: 2,
      email: 'bob@example.com',
      name: 'Bob Marley',
    },
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConversationListComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ConversationListComponent);
    component = fixture.componentInstance;
    component.conversations = [mockConv];
    fixture.detectChanges();
  });

  it('should create and list conversations', () => {
    expect(component).toBeTruthy();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.partner-name')?.textContent).toContain('Bob Marley');
  });

  it('should emit callHistoryClicked when clicking call history button', () => {
    const historySpy = vi.spyOn(component.callHistoryClicked, 'emit');
    const historyBtn = fixture.nativeElement.querySelector('button[title="View Call History"]') as HTMLButtonElement;
    expect(historyBtn).toBeTruthy();
    historyBtn.click();
    expect(historySpy).toHaveBeenCalled();
  });

  it('should emit newChatClicked when clicking start new conversation button', () => {
    const newChatSpy = vi.spyOn(component.newChatClicked, 'emit');
    const newChatBtn = fixture.nativeElement.querySelector('button[title="Start new conversation"]') as HTMLButtonElement;
    expect(newChatBtn).toBeTruthy();
    newChatBtn.click();
    expect(newChatSpy).toHaveBeenCalled();
  });
});
