/**
 * Unit tests for auth store role-based helper functions
 */

import { renderHook, act } from '@testing-library/react-native';
import { useAuthStore } from '@stores/auth-store';

// Mock the auth service
jest.mock('@services/auth-service', () => ({
  authService: {
    login: jest.fn(),
    logout: jest.fn(),
    checkSession: jest.fn(),
  },
}));

// Mock session storage
jest.mock('@services/session-storage', () => ({
  sessionStorage: {
    saveSession: jest.fn(),
    getCurrentUser: jest.fn(),
    clearSession: jest.fn(),
  },
}));

// Mock session manager
jest.mock('@services/session-manager', () => ({
  sessionManager: {
    initialize: jest.fn(),
    logout: jest.fn(),
    extendSession: jest.fn(),
    options: null,
  },
}));

describe('Auth Store Role Helpers', () => {
  beforeEach(() => {
    // Reset store to initial state
    const { result } = renderHook(() => useAuthStore());
    act(() => {
      result.current.logout();
    });
  });

  describe('isSupervisor', () => {
    it('should return false when not authenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.isSupervisor()).toBe(false);
    });

    it('should return false when authenticated as operator', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        // Simulate successful login as operator
        result.current.user = {
          id: '1',
          name: 'Test Operator',
          role: 'operator',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.isSupervisor()).toBe(false);
    });

    it('should return true when authenticated as supervisor', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        // Simulate successful login as supervisor
        result.current.user = {
          id: '2',
          name: 'Test Supervisor',
          role: 'supervisor',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.isSupervisor()).toBe(true);
    });
  });

  describe('canAccessDashboard', () => {
    it('should return false when not authenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.canAccessDashboard()).toBe(false);
    });

    it('should return false when authenticated as operator', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.user = {
          id: '1',
          name: 'Test Operator',
          role: 'operator',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.canAccessDashboard()).toBe(false);
    });

    it('should return true when authenticated as supervisor', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.user = {
          id: '2',
          name: 'Test Supervisor',
          role: 'supervisor',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.canAccessDashboard()).toBe(true);
    });
  });

  describe('canManageUsers', () => {
    it('should return false when not authenticated', () => {
      const { result } = renderHook(() => useAuthStore());
      
      expect(result.current.canManageUsers()).toBe(false);
    });

    it('should return false when authenticated as operator', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.user = {
          id: '1',
          name: 'Test Operator',
          role: 'operator',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.canManageUsers()).toBe(false);
    });

    it('should return true when authenticated as supervisor', () => {
      const { result } = renderHook(() => useAuthStore());
      
      act(() => {
        result.current.user = {
          id: '2',
          name: 'Test Supervisor',
          role: 'supervisor',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.canManageUsers()).toBe(true);
    });
  });

  describe('integration with existing functionality', () => {
    it('should maintain role helpers after logout', async () => {
      const { result } = renderHook(() => useAuthStore());
      
      // Set up authenticated supervisor
      act(() => {
        result.current.user = {
          id: '2',
          name: 'Test Supervisor',
          role: 'supervisor',
          active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_login: '2023-01-01T00:00:00Z',
        };
        result.current.isAuthenticated = true;
      });

      expect(result.current.isSupervisor()).toBe(true);
      expect(result.current.canAccessDashboard()).toBe(true);
      expect(result.current.canManageUsers()).toBe(true);

      // Logout
      await act(async () => {
        await result.current.logout();
      });

      // Should all return false after logout
      expect(result.current.isSupervisor()).toBe(false);
      expect(result.current.canAccessDashboard()).toBe(false);
      expect(result.current.canManageUsers()).toBe(false);
    });
  });
});