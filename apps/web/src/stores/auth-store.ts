/**
 * Authentication Store - Web Version
 * Zustand store for managing authentication state and session management
 * Adapted from mobile app for web environment
 */

import { create } from 'zustand';
import { type User } from '../types/auth';

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  sessionWarning: {
    show: boolean;
    remainingTime: number;
  };

  // Actions
  login: (name: string) => Promise<void>;
  logout: () => Promise<void>;
  initializeSession: () => Promise<void>;
  clearError: () => void;
  extendSession: () => Promise<void>;
  handleSessionExpired: () => void;
  handleSessionWarning: (remainingTime: number) => void;
  dismissSessionWarning: () => void;
  
  // Role-based helper functions
  isSupervisor: () => boolean;
  canAccessDashboard: () => boolean;
  canManageUsers: () => boolean;
}

// Web-specific storage helpers
const WEB_STORAGE_KEY = 'meat_reception_user';

const webStorage = {
  saveUser: (user: User): void => {
    localStorage.setItem(WEB_STORAGE_KEY, JSON.stringify(user));
  },
  
  getUser: (): User | null => {
    try {
      const stored = localStorage.getItem(WEB_STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  },
  
  clearUser: (): void => {
    localStorage.removeItem(WEB_STORAGE_KEY);
  }
};

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  sessionWarning: {
    show: false,
    remainingTime: 0,
  },

  // Login action - Simplified for now, will integrate with API later
  login: async (name: string) => {
    try {
      set({ isLoading: true, error: null });

      // TODO: Replace with actual API call
      // For now, simulate successful login
      const mockUser: User = {
        id: '1',
        name,
        role: name.toLowerCase().includes('supervisor') ? 'supervisor' : 'operator',
        active: true,
        created_at: new Date().toISOString(),
        last_login: new Date().toISOString(),
      };

      // Save to localStorage
      webStorage.saveUser(mockUser);
      
      set({
        user: mockUser,
        isAuthenticated: true,
        isLoading: false,
        error: null,
      });

      console.log('Login successful:', mockUser);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      set({
        isLoading: false,
        error: errorMessage,
        user: null,
        isAuthenticated: false,
      });
      throw error;
    }
  },

  // Logout action
  logout: async () => {
    try {
      set({ isLoading: true });

      // TODO: Add API logout call when available
      
      // Clear local storage
      webStorage.clearUser();

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        sessionWarning: { show: false, remainingTime: 0 },
      });

      console.log('Logout successful');
    } catch (error) {
      // Even if API call fails, clear local session
      webStorage.clearUser();
      
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        sessionWarning: { show: false, remainingTime: 0 },
      });
      
      console.error('Error during logout:', error);
    }
  },

  // Initialize session on app start
  initializeSession: async () => {
    try {
      set({ isLoading: true });

      // Check if we have a stored session
      const storedUser = webStorage.getUser();
      
      if (storedUser) {
        // TODO: Verify session is still valid with backend when API is available
        
        // For now, restore from localStorage
        set({
          user: storedUser,
          isAuthenticated: true,
          isLoading: false,
        });

        console.log('Session restored:', storedUser);
        return;
      }

      // No stored session found
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error initializing session:', error);
      
      // Clear any corrupted session data
      webStorage.clearUser();
      
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: 'Error al inicializar la sesión',
      });
    }
  },

  // Clear error state
  clearError: () => {
    set({ error: null });
  },

  // Extend current session - TODO: Implement with API
  extendSession: async () => {
    try {
      // TODO: Implement session extension with API
      set({ 
        sessionWarning: { show: false, remainingTime: 0 },
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al extender la sesión';
      set({ error: errorMessage });
      throw error;
    }
  },

  // Handle session expiration
  handleSessionExpired: () => {
    webStorage.clearUser();
    set({
      user: null,
      isAuthenticated: false,
      error: 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.',
      sessionWarning: { show: false, remainingTime: 0 },
    });
  },

  // Handle session warning
  handleSessionWarning: (remainingTime: number) => {
    set({
      sessionWarning: {
        show: true,
        remainingTime,
      },
    });
  },

  // Dismiss session warning
  dismissSessionWarning: () => {
    set({
      sessionWarning: { show: false, remainingTime: 0 },
    });
  },

  // Role-based helper functions
  isSupervisor: () => {
    const { user, isAuthenticated } = get();
    return isAuthenticated && user?.role === 'supervisor';
  },

  canAccessDashboard: () => {
    const { user, isAuthenticated } = get();
    return isAuthenticated && user?.role === 'supervisor';
  },

  canManageUsers: () => {
    const { user, isAuthenticated } = get();
    return isAuthenticated && user?.role === 'supervisor';
  },
}));