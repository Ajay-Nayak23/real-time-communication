import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ChatService } from './chat.service';
import { environment } from '../../../environments/environment';
import { Conversation, Message } from '../models/chat.model';

describe('ChatService', () => {
  let service: ChatService;
  let httpMock: HttpTestingController;

  const mockUser1 = { id: 1, email: 'alice@example.com', name: 'Alice' };
  const mockUser2 = { id: 2, email: 'bob@example.com', name: 'Bob' };

  const mockConversations: Conversation[] = [
    {
      id: 1,
      created_at: '2026-10-24T18:00:00Z',
      updated_at: '2026-10-24T18:05:00Z',
      participants: [
        { id: 1, user: mockUser1, joined_at: '2026-10-24T18:00:00Z' },
        { id: 2, user: mockUser2, joined_at: '2026-10-24T18:00:00Z' },
      ],
      other_participant: mockUser2,
      last_message: {
        id: 1,
        sender_id: 2,
        sender_name: 'Bob',
        content: 'Hello Alice',
        is_read: false,
        created_at: '2026-10-24T18:05:00Z',
      },
      unread_count: 1,
    },
  ];

  const mockMessages: Message[] = [
    {
      id: 1,
      conversation_id: 1,
      sender: mockUser2,
      content: 'Hello Alice',
      is_read: false,
      created_at: '2026-10-24T18:05:00Z',
      updated_at: '2026-10-24T18:05:00Z',
    },
  ];

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ChatService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(ChatService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created with initial empty signals', () => {
    expect(service).toBeTruthy();
    expect(service.conversations()).toEqual([]);
    expect(service.activeConversation()).toBeNull();
    expect(service.messages()).toEqual([]);
  });

  it('should load conversations and update signal', () => {
    service.loadConversations().subscribe((convs) => {
      expect(convs.length).toBe(1);
      expect(convs[0].id).toBe(1);
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/conversations/`);
    expect(req.request.method).toBe('GET');
    req.flush(mockConversations);

    expect(service.conversations()).toEqual(mockConversations);
    expect(service.loadingConversations()).toBe(false);
  });

  it('should load messages for a conversation and update messages signal', () => {
    service.loadMessages(1).subscribe((res) => {
      expect(res.results.length).toBe(1);
      expect(res.results[0].content).toBe('Hello Alice');
    });

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/chat/conversations/1/messages/` && r.params.get('ordering') === 'created_at'
    );
    expect(req.request.method).toBe('GET');
    req.flush({ next: null, previous: null, results: mockMessages });

    expect(service.messages()).toEqual(mockMessages);
    expect(service.loadingMessages()).toBe(false);
  });

  it('should send a message and append it to messages signal', () => {
    service.conversations.set(mockConversations);
    const newMsg: Message = {
      id: 2,
      conversation_id: 1,
      sender: mockUser1,
      content: 'Hi Bob!',
      is_read: false,
      created_at: '2026-10-24T18:06:00Z',
      updated_at: '2026-10-24T18:06:00Z',
    };

    service.sendMessage(1, 'Hi Bob!').subscribe((res) => {
      expect(res.id).toBe(2);
      expect(res.content).toBe('Hi Bob!');
    });

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/conversations/1/messages/`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ content: 'Hi Bob!' });
    req.flush(newMsg);

    expect(service.messages().length).toBe(1);
    expect(service.messages()[0].id).toBe(2);
    expect(service.conversations()[0].last_message?.content).toBe('Hi Bob!');
  });

  it('should select active conversation and load its messages', () => {
    service.selectConversation(mockConversations[0]);
    expect(service.activeConversation()?.id).toBe(1);

    const req = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/chat/conversations/1/messages/`
    );
    req.flush({ next: null, previous: null, results: mockMessages });
  });
});
