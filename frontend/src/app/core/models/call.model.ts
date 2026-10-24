import { User } from './user.model';

export type CallType = 'audio' | 'video';
export type CallStatus =
  | 'ringing'
  | 'ongoing'
  | 'rejected'
  | 'missed'
  | 'ended'
  | 'busy'
  | 'failed';

export type CallUiState = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

export interface ActiveCall {
  call_id: number;
  partner_id: number;
  partner_name: string;
  partner_avatar?: string | null;
  call_type: CallType;
  is_caller: boolean;
  started_at?: string | null;
}

export interface CallRecord {
  id: number;
  uuid: string;
  caller: User;
  callee: User;
  other_participant?: User | null;
  call_type: CallType;
  status: CallStatus;
  duration: number;
  started_at?: string | null;
  ended_at?: string | null;
  created_at: string;
}

export interface CallInviteEvent {
  type: 'call_invite';
  call_id: number;
  caller_id: number;
  caller_name: string;
  caller_avatar?: string | null;
  call_type: CallType;
  created_at: string;
}

export interface CallHistoryResponse {
  count?: number;
  next: string | null;
  previous: string | null;
  results: CallRecord[];
}

