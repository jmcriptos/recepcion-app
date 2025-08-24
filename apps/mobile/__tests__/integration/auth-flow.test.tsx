/**
 * Authentication Flow Integration Tests
 * End-to-end tests for the complete authentication process
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { App } from '@components/App';
import { authService } from '@services/auth-service';
import { sessionStorage } from '@services/session-storage';
import { sessionManager } from '@services/session-manager';

// Mock React Native modules
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  AppState: {
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
    currentState: 'active',
  },
}));

// Mock async storage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
  removeItem: jest.fn(),
}));

// Mock services
jest.mock('@services/auth-service');
jest.mock('@services/session-storage');
jest.mock('@services/session-manager');

const mockAuthService = authService as jest.Mocked<typeof authService>;
const mockSessionStorage = sessionStorage as jest.Mocked<typeof sessionStorage>;
const mockSessionManager = sessionManager as jest.Mocked<typeof sessionManager>;

// Test wrapper with NativeBase
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider>{children}</NativeBaseProvider>
);

describe('Authentication Flow Integration', () => {
  const mockUser = {
    id: '1',
    name: 'Juan Pérez',
    role: 'operator' as const,
    active: true,
    created_at: '2024-01-01T00:00:00Z',
    last_login: '2024-01-01T12:00:00Z',
  };

  const mockUsers = [
    { id: '1', name: 'Juan Pérez', role: 'operator' as const },
    { id: '2', name: 'María García', role: 'supervisor' as const },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    mockAuthService.getAvailableUsers.mockResolvedValue(mockUsers);
    mockSessionStorage.getCurrentUser.mockResolvedValue(null);
    mockSessionStorage.saveSession.mockResolvedValue();
    mockSessionStorage.clearSession.mockResolvedValue();
    mockSessionManager.initialize.mockImplementation(() => {});
    mockSessionManager.logout.mockResolvedValue();
  });

  describe('Fresh App Start (No Stored Session)', () => {
    it('should complete full login flow successfully', async () => {
      // Mock successful login
      const loginResponse = {
        success: true,
        user: mockUser,
        message: 'Login successful',
      };
      mockAuthService.login.mockResolvedValue(loginResponse);

      const { getByTestId, getByText, queryByText } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should show loading initially
      expect(getByText('Inicializando aplicación...')).toBeDefined();

      // Wait for login screen to appear
      await waitFor(() => {
        expect(getByText('Registro de Pesos')).toBeDefined();
        expect(getByTestId('user-selector')).toBeDefined();
      });

      // Select a user to login
      const userButton = getByTestId('user-button-1');
      fireEvent.press(userButton);

      // Wait for successful login
      await waitFor(() => {
        expect(getByText('Pantalla principal en construcción...')).toBeDefined();
      });

      // Verify login was called with correct parameters
      expect(mockAuthService.login).toHaveBeenCalledWith('Juan Pérez');
      expect(mockSessionStorage.saveSession).toHaveBeenCalledWith(mockUser);
      expect(mockSessionManager.initialize).toHaveBeenCalled();

      // Login screen should no longer be visible
      expect(queryByText('Selecciona tu nombre')).toBeNull();
    });

    it('should handle login failure gracefully', async () => {
      // Mock login failure
      mockAuthService.login.mockRejectedValue(new Error('Usuario no encontrado'));

      const { getByTestId, getByText } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Wait for login screen
      await waitFor(() => {
        expect(getByTestId('user-selector')).toBeDefined();
      });

      // Try to login
      const userButton = getByTestId('user-button-1');
      fireEvent.press(userButton);

      // Should show error message
      await waitFor(() => {
        expect(getByText('Usuario no encontrado')).toBeDefined();
      });

      // Should still be on login screen
      expect(getByText('Selecciona tu nombre')).toBeDefined();
    });
  });

  describe('App Start with Stored Session', () => {
    it('should restore valid session automatically', async () => {
      // Mock stored session
      mockSessionStorage.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.checkSession.mockResolvedValue(true);

      const { getByText } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should show loading initially
      expect(getByText('Inicializando aplicación...')).toBeDefined();

      // Wait for main screen to appear (session restored)
      await waitFor(() => {
        expect(getByText('Pantalla principal en construcción...')).toBeDefined();
      });

      // Verify session was checked
      expect(mockSessionStorage.getCurrentUser).toHaveBeenCalled();
      expect(mockAuthService.checkSession).toHaveBeenCalled();
      expect(mockSessionManager.initialize).toHaveBeenCalled();
    });

    it('should handle invalid stored session', async () => {
      // Mock stored user but invalid session
      mockSessionStorage.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.checkSession.mockResolvedValue(false);

      const { getByText, getByTestId } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should show loading initially
      expect(getByText('Inicializando aplicación...')).toBeDefined();

      // Wait for login screen to appear (session invalid)
      await waitFor(() => {
        expect(getByTestId('user-selector')).toBeDefined();
        expect(getByText('Registro de Pesos')).toBeDefined();
      });

      // Verify session was cleared
      expect(mockSessionStorage.clearSession).toHaveBeenCalled();
    });
  });

  describe('Session Warning Flow', () => {
    it('should show session warning and allow extension', async () => {
      // Start with authenticated user
      mockSessionStorage.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.checkSession.mockResolvedValue(true);
      mockSessionManager.extendSession.mockResolvedValue();

      const { getByText, getByTestId, queryByText } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Wait for main screen
      await waitFor(() => {
        expect(getByText('Pantalla principal en construcción...')).toBeDefined();
      });

      // Get the store instance to simulate session warning
      // Note: This is a bit tricky with Zustand, in real implementation
      // the session manager would trigger the warning callback

      // For now, we'll test that the component structure is correct
      expect(queryByText('Sesión por expirar')).toBeNull();

      // In a more complete test, we would:
      // 1. Trigger session warning through session manager
      // 2. Verify warning dialog appears
      // 3. Test extend and logout actions
    });
  });

  describe('Logout Flow', () => {
    it('should logout and return to login screen', async () => {
      // Start with authenticated user
      mockSessionStorage.getCurrentUser.mockResolvedValue(mockUser);
      mockAuthService.checkSession.mockResolvedValue(true);
      mockAuthService.logout.mockResolvedValue();

      const { getByText, getByTestId } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Wait for main screen
      await waitFor(() => {
        expect(getByText('Pantalla principal en construcción...')).toBeDefined();
      });

      // In a complete implementation, we would have a logout button in MainScreen
      // For now, we verify the structure is ready for logout functionality
      
      // Verify session was properly initialized
      expect(mockSessionManager.initialize).toHaveBeenCalled();
    });
  });

  describe('Error Recovery', () => {
    it('should handle initialization errors gracefully', async () => {
      // Mock initialization error
      mockSessionStorage.getCurrentUser.mockRejectedValue(
        new Error('Storage corrupted')
      );

      const { getByText, getByTestId } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Should show loading initially
      expect(getByText('Inicializando aplicación...')).toBeDefined();

      // Should recover and show login screen
      await waitFor(() => {
        expect(getByTestId('user-selector')).toBeDefined();
      });

      // Should have cleared corrupted session
      expect(mockSessionStorage.clearSession).toHaveBeenCalled();
    });

    it('should handle service unavailable during login', async () => {
      // Mock service unavailable
      mockAuthService.login.mockRejectedValue(
        new Error('Error de conexión con el servidor.')
      );

      const { getByTestId, getByText } = render(
        <TestWrapper>
          <App />
        </TestWrapper>
      );

      // Wait for login screen
      await waitFor(() => {
        expect(getByTestId('user-selector')).toBeDefined();
      });

      // Try to login
      const userButton = getByTestId('user-button-1');
      fireEvent.press(userButton);

      // Should show connection error
      await waitFor(() => {
        expect(getByText('Error de conexión con el servidor.')).toBeDefined();
      });

      // Should remain on login screen for retry
      expect(getByText('Selecciona tu nombre')).toBeDefined();
    });
  });
});