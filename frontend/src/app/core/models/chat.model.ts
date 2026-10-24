import { User } from './user.model';

export interface Participant {
  id: number;
  user: User;
  joined_at: string;
}

export interface MessageSummary {
  id: number;
  sender_id: number;
  sender_name: string;
  content: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface Conversation {
  id: number;
  created_at: string;
  updated_at: string;
  participants: Participant[];
  other_participant?: User | null;
  last_message?: MessageSummary | null;
  unread_count: number;
}

export interface Message {
  id: number;
  conversation_id: number;
  sender: User;
  content: string;
  is_read: boolean;
  read_at?: string | null;
  is_deleted?: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateConversationRequest {
  recipient_id?: number;
  recipient_email?: string;
}

export interface SendMessageRequest {
  content: string;
}

export interface MessageHistoryResponse {
  count?: number;
  next: string | null;
  previous: string | null;
  results: Message[];
}

export interface TypingIndicator {
  conversation_id: number;
  user_id: number;
  user_name?: string;
  is_typing: boolean;
}

export interface PresenceUpdate {
  user_id: number;
  status: 'online' | 'offline';
  last_seen?: string | null;
}

export interface UserPresenceStatus {
  user_id: number;
  is_online: boolean;
  last_seen?: string | null;
}
