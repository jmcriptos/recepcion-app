/**
 * Authentication Store Tests
 * Unit tests for Zustand auth store functionality
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '@stores/auth-store';
import { authService } from '@services/auth-service';
import { sessionStorage } from '@services/session-storage';
import { sessionManager } from '@services/session-manager';

// Mock dependencies
jest.mock('@services/auth-service');
jest.mock('@services/session-storage');
jest.mock('@services/session-manager');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockSessionStorage = sessionStorage as jest.Mocked<typeof sessionStorage>;
const mockSessionManager = sessionManager as jest.Mocked<typeof sessionManager>;

describe('Auth Store', () => {
  beforeEach(() => {
    // Reset store state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });
    
    // Clear all mocks
    jest.clearAllMocks();
  });

  describe('Initial State', () => {
    it('should have correct initial state', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
      expect(result.current.sessionWarning.show).toBe(false);
    });
  });

  describe('Login', () => {
    const mockUser = {
      id: '1',
      name: 'Juan Pérez',
      role: 'operator' as const,
      active: true,
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-01T12:00:00Z',
    };

    it('should login successfully', async () => {
      const mockResponse = {
        success: true,
        user: mockUser,
        message: 'Login successful',
      };
      
      mockAuthService.login.mockResolvedValue(mockResponse);
      mockSessionStorage.saveSession.mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.login('Juan Pérez');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.error).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockAuthService.login).toHaveBeenCalledWith('Juan Pérez');
      expect(mockSessionStorage.saveSession).toHaveBeenCalledWith(mockUser);
    });

    it('should handle login failure', async () => {
      const errorMessage = 'Usuario no encontrado';
      mockAuthService.login.mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('Invalid User');
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe(errorMessage);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle login with invalid response', async () => {
      const mockResponse = {
        success: false,
        user: null,
        message: 'Authentication failed',
      };
      
      mockAuthService.login.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        try {
          await result.current.login('Test User');
        } catch (error) {
          // Expected error
        }
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe('Authentication failed');
    });
  });

  describe('Logout', () => {
    it('should logout successfully', async () => {
      mockAuthService.logout.mockResolvedValue();
      mockSessionManager.logout.mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.user = {
          id: '1',
          name: 'Test User',
          role: 'operator',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
          last_login: '2024-01-01T12:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.sessionWarning.show).toBe(false);
      expect(mockAuthService.logout).toHaveBeenCalled();
      expect(mockSessionManager.logout).toHaveBeenCalled();
    });

    it('should handle logout with API error', async () => {
      mockAuthService.logout.mockRejectedValue(new Error('API Error'));
      mockSessionManager.logout.mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.logout();
      });

      // Should still clear local state even if API fails
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(mockSessionManager.logout).toHaveBeenCalled();
    });
  });

  describe('Session Initialization', () => {
    const mockUser = {
      id: '1',
      name: 'Juan Pérez',
      role: 'operator' as const,
      active: true,
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-01T12:00:00Z',
    };

    it('should initialize with valid stored session', async () => {
      mockSessionStorage.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.checkSession.mockResolvedValue(true);

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initializeSession();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
      expect(mockSessionManager.initialize).toHaveBeenCalled();
    });

    it('should handle invalid stored session', async () => {
      mockSessionStorage.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.checkSession.mockResolvedValue(false);
      mockSessionStorage.clearSession.mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initializeSession();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(mockSessionStorage.clearSession).toHaveBeenCalled();
    });

    it('should handle no stored session', async () => {
      mockSessionStorage.getCurrentUser.mockResolvedValue(null);
      mockSessionStorage.clearSession.mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      await act(async () => {
        await result.current.initializeSession();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isLoading).toBe(false);
    });
  });

  describe('Session Management', () => {
    it('should extend session successfully', async () => {
      mockSessionManager.extendSession.mockResolvedValue();

      const { result } = renderHook(() => useAuthStore());

      // Set session warning state
      act(() => {
        result.current.handleSessionWarning(300000); // 5 minutes
      });

      await act(async () => {
        await result.current.extendSession();
      });

      expect(result.current.sessionWarning.show).toBe(false);
      expect(result.current.sessionWarning.remainingTime).toBe(0);
      expect(result.current.error).toBeNull();
      expect(mockSessionManager.extendSession).toHaveBeenCalled();
    });

    it('should handle session expiration', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set initial authenticated state
      act(() => {
        result.current.user = {
          id: '1',
          name: 'Test User',
          role: 'operator',
          active: true,
          created_at: '2024-01-01T00:00:00Z',
          last_login: '2024-01-01T12:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      act(() => {
        result.current.handleSessionExpired();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.error).toBe('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
      expect(result.current.sessionWarning.show).toBe(false);
    });

    it('should handle session warning', () => {
      const { result } = renderHook(() => useAuthStore());
      const remainingTime = 600000; // 10 minutes

      act(() => {
        result.current.handleSessionWarning(remainingTime);
      });

      expect(result.current.sessionWarning.show).toBe(true);
      expect(result.current.sessionWarning.remainingTime).toBe(remainingTime);
    });

    it('should dismiss session warning', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set warning first
      act(() => {
        result.current.handleSessionWarning(300000);
      });

      act(() => {
        result.current.dismissSessionWarning();
      });

      expect(result.current.sessionWarning.show).toBe(false);
      expect(result.current.sessionWarning.remainingTime).toBe(0);
    });
  });

  describe('Error Management', () => {
    it('should clear error', () => {
      const { result } = renderHook(() => useAuthStore());

      // Set error first
      act(() => {
        result.current.error = 'Test error';
      });

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });
  });
});