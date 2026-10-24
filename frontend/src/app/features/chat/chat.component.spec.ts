import { TestBed, ComponentFixture } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ChatComponent } from './chat.component';
import { AuthService } from '../../core/services/auth.service';
import { ChatService } from '../../core/services/chat.service';
import { UserService } from '../../core/services/user.service';
import { Conversation, Message } from '../../core/models/chat.model';

describe('ChatComponent', () => {
  let fixture: ComponentFixture<ChatComponent>;
  let component: ChatComponent;
  let authService: AuthService;
  let chatService: ChatService;
  let httpMock: HttpTestingController;

  const mockCurrentUser = { id: 1, email: 'alice@example.com', name: 'Alice' };
  const mockPeerUser = { id: 2, email: 'bob@example.com', name: 'Bob' };

  const mockConversations: Conversation[] = [
    {
      id: 1,
      created_at: '2026-10-24T18:00:00Z',
      updated_at: '2026-10-24T18:05:00Z',
      participants: [
        { id: 1, user: mockCurrentUser, joined_at: '2026-10-24T18:00:00Z' },
        { id: 2, user: mockPeerUser, joined_at: '2026-10-24T18:00:00Z' },
      ],
      other_participant: mockPeerUser,
      last_message: {
        id: 10,
        sender_id: 2,
        sender_name: 'Bob',
        content: 'Hey Alice!',
        is_read: false,
        created_at: '2026-10-24T18:05:00Z',
      },
      unread_count: 2,
    },
  ];

  const mockMessages: Message[] = [
    {
      id: 10,
      conversation_id: 1,
      sender: mockPeerUser,
      content: 'Hey Alice!',
      is_read: false,
      created_at: '2026-10-24T18:05:00Z',
      updated_at: '2026-10-24T18:05:00Z',
    },
    {
      id: 11,
      conversation_id: 1,
      sender: mockCurrentUser,
      content: 'Hi Bob, how are you?',
      is_read: true,
      created_at: '2026-10-24T18:06:00Z',
      updated_at: '2026-10-24T18:06:00Z',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ChatComponent],
      providers: [
        AuthService,
        ChatService,
        UserService,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    authService = TestBed.inject(AuthService);
    chatService = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);

    authService.currentUser.set(mockCurrentUser);

    fixture = TestBed.createComponent(ChatComponent);
    component = fixture.componentInstance;
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should create the chat component', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('/api/chat/conversations/'));
    req.flush([]);
    expect(component).toBeTruthy();
  });

  it('should render empty selection state when no conversation is active', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('/api/chat/conversations/'));
    req.flush([]);

    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.no-selection-card h2')?.textContent).toContain(
      'Select a Conversation'
    );
  });

  it('should render conversation list in sidebar with unread badge and last message', () => {
    chatService.conversations.set(mockConversations);
    fixture.detectChanges();

    const req = httpMock.expectOne((r) => r.url.includes('/api/chat/conversations/'));
    req.flush(mockConversations);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.partner-name')?.textContent).toContain('Bob');
    expect(compiled.querySelector('.message-preview')?.textContent).toContain('Hey Alice!');
    expect(compiled.querySelector('.unread-badge')?.textContent).toContain('2');
  });

  it('should render message window with incoming and outgoing bubbles when conversation is active', () => {
    chatService.conversations.set(mockConversations);
    chatService.activeConversation.set(mockConversations[0]);
    chatService.messages.set(mockMessages);

    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('/api/chat/conversations/'));
    req.flush(mockConversations);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    const bubbles = compiled.querySelectorAll('.msg-bubble');
    expect(bubbles.length).toBe(2);

    // Incoming bubble (peer)
    expect(bubbles[0].classList.contains('incoming')).toBe(true);
    expect(bubbles[0].textContent).toContain('Hey Alice!');

    // Outgoing bubble (self)
    expect(bubbles[1].classList.contains('outgoing')).toBe(true);
    expect(bubbles[1].textContent).toContain('Hi Bob, how are you?');
  });

  it('should trigger sendMessage when onSendMessage is called', () => {
    fixture.detectChanges();
    const req = httpMock.expectOne((r) => r.url.includes('/api/chat/conversations/'));
    req.flush([]);

    chatService.activeConversation.set(mockConversations[0]);
    const sendSpy = vi.spyOn(chatService, 'sendMessage').mockReturnValue(of(mockMessages[1]));

    component.onSendMessage('Testing send message');
    expect(sendSpy).toHaveBeenCalledWith(1, 'Testing send message');
  });

  it('should initiate audio call when onStartAudioCall is invoked', async () => {
    const startCallSpy = vi.spyOn(component.webrtcService, 'startCall').mockResolvedValue();
    component.onStartAudioCall(mockPeerUser);
    expect(startCallSpy).toHaveBeenCalledWith(2, 'Bob', 'audio', undefined);
  });

  it('should toggle call history modal', () => {
    expect(component.showCallHistoryModal()).toBe(false);
    component.openCallHistoryModal();
    expect(component.showCallHistoryModal()).toBe(true);
    component.closeCallHistoryModal();
    expect(component.showCallHistoryModal()).toBe(false);
  });
});

