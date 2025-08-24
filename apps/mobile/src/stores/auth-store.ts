/**
 * Authentication Store
 * Zustand store for managing authentication state and session management
 */

import { create } from 'zustand';
import { User } from '../types/auth';
import { authService } from '../services/auth-service';
import { sessionStorage } from '../services/session-storage';
import { sessionManager } from '../services/session-manager';

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

  // Login action
  login: async (name: string) => {
    try {
      set({ isLoading: true, error: null });

      // Call API login
      const response = await authService.login(name);
      
      if (response.success && response.user) {
        // Save session to secure storage
        await sessionStorage.saveSession(response.user);
        
        set({
          user: response.user,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });

        // Initialize session manager if not already done
        const state = get();
        if (!sessionManager.isInitialized) {
          sessionManager.initialize({
            onSessionExpired: state.handleSessionExpired,
            onSessionWarning: state.handleSessionWarning,
            onSessionExtended: () => {
              set({ sessionWarning: { show: false, remainingTime: 0 } });
            },
          });
        }
      } else {
        throw new Error(response.message || 'Error de autenticación');
      }
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

      // Call API logout
      await authService.logout();
      
      // Clear session storage
      await sessionManager.logout();

      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
        error: null,
        sessionWarning: { show: false, remainingTime: 0 },
      });
    } catch (error) {
      // Even if API call fails, clear local session
      await sessionManager.logout();
      
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
      const storedUser = await sessionStorage.getCurrentUser();
      
      if (storedUser) {
        // Verify session is still valid with backend
        const isValidSession = await authService.checkSession();
        
        if (isValidSession) {
          // Session is valid, restore authentication state
          set({
            user: storedUser,
            isAuthenticated: true,
            isLoading: false,
          });

          // Initialize session manager
          const state = get();
          sessionManager.initialize({
            onSessionExpired: state.handleSessionExpired,
            onSessionWarning: state.handleSessionWarning,
            onSessionExtended: () => {
              set({ sessionWarning: { show: false, remainingTime: 0 } });
            },
          });

          return;
        }
      }

      // No valid session found
      await sessionStorage.clearSession();
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    } catch (error) {
      console.error('Error initializing session:', error);
      
      // Clear any corrupted session data
      await sessionStorage.clearSession();
      
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

  // Extend current session
  extendSession: async () => {
    try {
      await sessionManager.extendSession();
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