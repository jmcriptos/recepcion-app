/**
 * Authentication Service Tests
 * Unit tests for authentication API service
 */

import { authService } from '@services/auth-service';

// Mock fetch globally
global.fetch = jest.fn();
const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe('Auth Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('login', () => {
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

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await authService.login('Juan Pérez');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/auth/login',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: 'Juan Pérez' }),
          credentials: 'include',
        })
      );
    });

    it('should handle API error response', async () => {
      const mockErrorResponse = {
        error: { message: 'Usuario no encontrado' },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => mockErrorResponse,
      } as Response);

      await expect(authService.login('Invalid User')).rejects.toThrow(
        'Usuario no encontrado'
      );
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network request failed'));

      await expect(authService.login('Test User')).rejects.toThrow(
        'Error de red. Verifica tu conexión a internet.'
      );
    });

    it('should handle timeout', async () => {
      mockFetch.mockRejectedValue(new Error('AbortError'));

      await expect(authService.login('Test User')).rejects.toThrow(
        'Tiempo de espera agotado. Intenta de nuevo.'
      );
    });

    it('should trim whitespace from name', async () => {
      const mockResponse = {
        success: true,
        user: mockUser,
        message: 'Login successful',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await authService.login('  Juan Pérez  ');

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/auth/login',
        expect.objectContaining({
          body: JSON.stringify({ name: 'Juan Pérez' }),
        })
      );
    });
  });

  describe('logout', () => {
    it('should logout successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(authService.logout()).resolves.toBeUndefined();

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/auth/logout',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
        })
      );
    });

    it('should handle logout error', async () => {
      const mockErrorResponse = {
        error: { message: 'Error al cerrar sesión' },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        json: async () => mockErrorResponse,
      } as Response);

      await expect(authService.logout()).rejects.toThrow('Error al cerrar sesión');
    });
  });

  describe('getCurrentUser', () => {
    const mockUser = {
      id: '1',
      name: 'Juan Pérez',
      role: 'operator' as const,
      active: true,
      created_at: '2024-01-01T00:00:00Z',
      last_login: '2024-01-01T12:00:00Z',
    };

    it('should get current user successfully', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await authService.getCurrentUser();

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:5000/api/v1/auth/current-user',
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('should handle session expired', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(authService.getCurrentUser()).rejects.toThrow(
        'Session expired'
      );
    });

    it('should handle other errors', async () => {
      const mockErrorResponse = {
        error: { message: 'Server error' },
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => mockErrorResponse,
      } as Response);

      await expect(authService.getCurrentUser()).rejects.toThrow('Server error');
    });
  });

  describe('checkSession', () => {
    it('should return true for valid session', async () => {
      const mockUser = {
        id: '1',
        name: 'Juan Pérez',
        role: 'operator' as const,
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        last_login: '2024-01-01T12:00:00Z',
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockUser,
      } as Response);

      const result = await authService.checkSession();

      expect(result).toBe(true);
    });

    it('should return false for invalid session', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      const result = await authService.checkSession();

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const result = await authService.checkSession();

      expect(result).toBe(false);
    });
  });

  describe('getAvailableUsers', () => {
    it('should return available users', async () => {
      const result = await authService.getAvailableUsers();

      expect(result).toHaveLength(5);
      expect(result[0]).toEqual({
        id: '1',
        name: 'Juan Pérez',
        role: 'operator',
      });
      expect(result[1]).toEqual({
        id: '2',
        name: 'María García',
        role: 'supervisor',
      });
    });
  });

  describe('makeRequest timeout', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should timeout requests after 10 seconds', async () => {
      mockFetch.mockImplementation(() => {
        return new Promise((resolve) => {
          // Never resolve to simulate hanging request
          setTimeout(() => resolve({} as Response), 15000);
        });
      });

      const loginPromise = authService.login('Test User');

      // Fast forward time
      jest.advanceTimersByTime(10000);

      await expect(loginPromise).rejects.toThrow(
        'Tiempo de espera agotado. Intenta de nuevo.'
      );
    });
  });
});