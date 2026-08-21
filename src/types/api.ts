export interface ApiErrorBody {
  error: string;
  details?: unknown;
}

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
}
