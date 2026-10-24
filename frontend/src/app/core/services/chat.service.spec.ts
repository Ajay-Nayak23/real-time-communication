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

  it('should select active conversation, load messages, and mark as read', () => {
    service.conversations.set(mockConversations);
    service.selectConversation(mockConversations[0]);
    expect(service.activeConversation()?.id).toBe(1);

    const msgReq = httpMock.expectOne(
      (r) => r.url === `${environment.apiUrl}/chat/conversations/1/messages/`
    );
    msgReq.flush({ next: null, previous: null, results: mockMessages });

    const readReq = httpMock.expectOne(`${environment.apiUrl}/chat/conversations/1/read/`);
    expect(readReq.request.method).toBe('POST');
    readReq.flush({ status: 'success', conversation_id: 1, read_count: 1 });

    expect(service.conversations()[0].unread_count).toBe(0);
  });

  it('should mark conversation as read explicitly', () => {
    service.conversations.set([{ ...mockConversations[0], unread_count: 5 }]);
    service.markConversationAsRead(1).subscribe((res) => {
      expect(res.read_count).toBe(5);
    });

    expect(service.conversations()[0].unread_count).toBe(0);

    const req = httpMock.expectOne(`${environment.apiUrl}/chat/conversations/1/read/`);
    expect(req.request.method).toBe('POST');
    req.flush({ status: 'success', conversation_id: 1, read_count: 5 });
  });

  it('should increment unread badge when message arrives for inactive conversation', () => {
    service.conversations.set([{ ...mockConversations[0], unread_count: 0 }]);
    service.activeConversation.set(null); // No conversation active

    const incoming: Message = {
      id: 50,
      conversation_id: 1,
      sender: mockUser2,
      content: 'New unread message',
      is_read: false,
      created_at: '2026-10-24T18:20:00Z',
      updated_at: '2026-10-24T18:20:00Z',
    };

    service.handleIncomingMessage(incoming);
    expect(service.conversations()[0].unread_count).toBe(1);
    expect(service.conversations()[0].last_message?.content).toBe('New unread message');
  });

  it('should update read receipts when messages_read event is received', () => {
    service.activeConversation.set(mockConversations[0]);
    service.messages.set([
      {
        id: 10,
        conversation_id: 1,
        sender: mockUser1,
        content: 'Delivered but not read',
        is_read: false,
        created_at: '2026-10-24T18:20:00Z',
        updated_at: '2026-10-24T18:20:00Z',
      },
    ]);

    service.handleMessagesRead({
      conversation_id: 1,
      reader_id: 2,
      read_at: '2026-10-24T18:22:00Z',
      read_count: 1,
    });

    expect(service.messages()[0].is_read).toBe(true);
    expect(service.messages()[0].read_at).toBe('2026-10-24T18:22:00Z');
  });

  it('should handle incoming message and deduplicate in message timeline', () => {
    service.conversations.set(mockConversations);
    service.messages.set(mockMessages);

    const duplicateMsg: Message = { ...mockMessages[0] };
    service.handleIncomingMessage(duplicateMsg);
    // Should still have length 1 because of deduplication
    expect(service.messages().length).toBe(1);

    const brandNewMsg: Message = {
      id: 99,
      conversation_id: 1,
      sender: mockUser2,
      content: 'Realtime update',
      is_read: false,
      created_at: '2026-10-24T18:10:00Z',
      updated_at: '2026-10-24T18:10:00Z',
    };
    service.handleIncomingMessage(brandNewMsg);
    expect(service.messages().length).toBe(2);
    expect(service.messages()[1].id).toBe(99);
    expect(service.conversations()[0].last_message?.content).toBe('Realtime update');
  });

  it('should properly track and disconnect websocket', () => {
    expect(service.socketConnected()).toBe(false);
    expect(service.isSocketOpen()).toBe(false);

    service.disconnectWebSocket();
    expect(service.socketConnected()).toBe(false);
  });

  it('should handle typing indicator events for active conversation', () => {
    service.activeConversation.set(mockConversations[0]);
    expect(service.typingUser()).toBeNull();

    service.handleTypingEvent({
      conversation_id: 1,
      user_id: 2,
      user_name: 'Bob',
      is_typing: true,
    });
    expect(service.typingUser()).toBe('Bob');

    service.handleTypingEvent({
      conversation_id: 1,
      user_id: 2,
      user_name: 'Bob',
      is_typing: false,
    });
    expect(service.typingUser()).toBeNull();
  });

  it('should ignore typing indicator events for other conversations', () => {
    service.activeConversation.set(mockConversations[0]); // id = 1
    service.handleTypingEvent({
      conversation_id: 999,
      user_id: 2,
      user_name: 'Bob',
      is_typing: true,
    });
    expect(service.typingUser()).toBeNull();
  });
});
