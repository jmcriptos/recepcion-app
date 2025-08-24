/**
 * Authentication Service
 * Handles API communication with backend authentication system
 * Integrates with Flask-Login backend from Story 2.1
 */

import { LoginRequest, LoginResponse, ErrorResponse, User } from '../types/auth';

class AuthService {
  private baseURL: string;
  private timeout: number;

  constructor() {
    // Production API URL pointing to Heroku deployment
    this.baseURL = 'https://chatclg.herokuapp.com/api/v1';
    this.timeout = 10000; // 10 seconds for mobile network conditions
  }

  /**
   * Perform user login with name-based authentication
   */
  async login(name: string): Promise<LoginResponse> {
    try {
      const requestBody: LoginRequest = { name: name.trim() };

      const response = await this.makeRequest('/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include', // Include cookies for session management
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      const userData: LoginResponse = await response.json();
      return userData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error de conexión. Verifica tu conexión a internet.');
    }
  }

  /**
   * Logout current user
   */
  async logout(): Promise<void> {
    try {
      const response = await this.makeRequest('/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error al cerrar sesión');
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<User> {
    try {
      const response = await this.makeRequest('/auth/current-user', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Session expired');
        }
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.error.message);
      }

      const userData: User = await response.json();
      return userData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Error al verificar sesión');
    }
  }

  /**
   * Check if user session is still valid
   */
  async checkSession(): Promise<boolean> {
    try {
      await this.getCurrentUser();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get list of available users for login
   * In real implementation, this might be a separate endpoint
   */
  async getAvailableUsers(): Promise<Pick<User, 'id' | 'name' | 'role'>[]> {
    try {
      // For now, return mock data
      // In real implementation, this would call an endpoint like /auth/users
      return [
        { id: '1', name: 'Juan Pérez', role: 'operator' },
        { id: '2', name: 'María García', role: 'supervisor' },
        { id: '3', name: 'Pedro López', role: 'operator' },
        { id: '4', name: 'Ana Rodríguez', role: 'supervisor' },
        { id: '5', name: 'Carlos Martínez', role: 'operator' },
      ];
    } catch (error) {
      throw new Error('Error al cargar usuarios');
    }
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Tiempo de espera agotado. Intenta de nuevo.');
        }
        if (error.message.includes('Network request failed')) {
          throw new Error('Error de red. Verifica tu conexión a internet.');
        }
        if (error.message.includes('fetch')) {
          throw new Error('Error de conexión con el servidor.');
        }
      }
      
      throw error;
    }
  }
}

// Export singleton instance
export const authService = new AuthService();
export default authService;