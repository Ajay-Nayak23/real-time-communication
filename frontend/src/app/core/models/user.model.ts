export interface User {
  id: number;
  email: string;
  name: string;
  bio?: string;
  profile_image?: string | null;
  avatar?: string | null;
  last_seen?: string | null;
  is_active?: boolean;
  is_staff?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UserProfileUpdateRequest {
  name?: string;
  bio?: string;
  avatar?: string | null;
  profile_image?: string | null;
}

export interface AuthResponse {
  access: string;
  refresh: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}
