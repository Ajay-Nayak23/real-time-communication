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
