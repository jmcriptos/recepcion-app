/**
 * Authentication-related type definitions
 * Based on backend API from Story 2.1
 */

export interface User {
  id: string;
  name: string;
  role: 'operator' | 'supervisor';
  active: boolean;
  created_at: string;
  last_login: string;
}

export interface LoginRequest {
  name: string;
}

export interface LoginResponse {
  success: boolean;
  user: User;
  message: string;
}

export interface ErrorResponse {
  error: {
    code: 'VALIDATION_ERROR' | 'AUTHENTICATION_ERROR' | 'RATE_LIMIT_EXCEEDED' | 'INTERNAL_ERROR';
    message: string;
    timestamp: string;
    requestId: string;
  };
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionTimeout: Date | null;
  lastActivity: Date | null;
}

export interface AuthActions {
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  checkSession: () => Promise<void>;
  clearError: () => void;
  updateLastActivity: () => void;
  startSessionTimer: () => void;
  stopSessionTimer: () => void;
}