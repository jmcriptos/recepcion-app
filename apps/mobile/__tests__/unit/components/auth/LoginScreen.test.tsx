/**
 * Login Screen Component Tests
 * Unit tests for the main authentication screen
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { useAuthStore } from '@stores/auth-store';
import { authService } from '@services/auth-service';

// Mock dependencies
jest.mock('@stores/auth-store');
jest.mock('@services/auth-service');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockAuthService = authService as jest.Mocked<typeof authService>;

// Test wrapper with NativeBase
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider>{children}</NativeBaseProvider>
);

describe('LoginScreen', () => {
  const mockLogin = jest.fn();
  const mockClearError = jest.fn();

  const defaultAuthState = {
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    sessionWarning: { show: false, remainingTime: 0 },
    login: mockLogin,
    logout: jest.fn(),
    initializeSession: jest.fn(),
    clearError: mockClearError,
    extendSession: jest.fn(),
    handleSessionExpired: jest.fn(),
    handleSessionWarning: jest.fn(),
    dismissSessionWarning: jest.fn(),
  };

  const mockUsers = [
    { id: '1', name: 'Juan Pérez', role: 'operator' as const },
    { id: '2', name: 'María García', role: 'supervisor' as const },
    { id: '3', name: 'Pedro López', role: 'operator' as const },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAuthStore.mockReturnValue(defaultAuthState);
    mockAuthService.getAvailableUsers.mockResolvedValue(mockUsers);
  });

  it('should render login screen with app branding', async () => {
    const { getByText, getByTestId } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    expect(getByText('Registro de Pesos')).toBeDefined();
    expect(getByText('Aplicación para recepción de carnes')).toBeDefined();
    expect(getByText('Versión 1.0.0')).toBeDefined();
    expect(getByText('Optimizado para uso industrial')).toBeDefined();

    // Wait for users to load
    await waitFor(() => {
      expect(getByTestId('user-selector')).toBeDefined();
    });
  });

  it('should load and display available users', async () => {
    const { getByTestId, getByText } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestId('user-selector')).toBeDefined();
      expect(getByText('Juan Pérez')).toBeDefined();
      expect(getByText('María García')).toBeDefined();
      expect(getByText('Pedro López')).toBeDefined();
    });

    expect(mockAuthService.getAvailableUsers).toHaveBeenCalled();
  });

  it('should show loading state initially', () => {
    const { getByText } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    expect(getByText('Cargando usuarios...')).toBeDefined();
  });

  it('should handle user selection and login', async () => {
    const { getByTestId } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestId('user-selector')).toBeDefined();
    });

    const userButton = getByTestId('user-button-1');
    fireEvent.press(userButton);

    expect(mockClearError).toHaveBeenCalled();
    expect(mockLogin).toHaveBeenCalledWith('Juan Pérez');
  });

  it('should display error state when login fails', async () => {
    const errorMessage = 'Usuario no encontrado';
    mockUseAuthStore.mockReturnValue({
      ...defaultAuthState,
      error: errorMessage,
    });

    const { getByText, getByTestId } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestId('login-error')).toBeDefined();
      expect(getByText(errorMessage)).toBeDefined();
    });
  });

  it('should show loading state during authentication', async () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultAuthState,
      isLoading: true,
    });

    const { getByTestId } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      const userSelector = getByTestId('user-selector');
      expect(userSelector).toBeDefined();
    });

    // User buttons should be disabled during loading
    const userButton = getByTestId('user-button-1');
    expect(userButton.props.accessibilityState.disabled).toBe(true);
  });

  it('should handle retry when error occurs', async () => {
    mockAuthService.getAvailableUsers
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockUsers);

    const { getByTestId, rerender } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestId('login-error')).toBeDefined();
    });

    const retryButton = getByTestId('login-error-retry-button');
    fireEvent.press(retryButton);

    // Re-render and wait for users to load
    rerender(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestId('user-selector')).toBeDefined();
    });
  });

  it('should display role badges for users', async () => {
    const { getByText } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('Operador')).toBeDefined();
      expect(getByText('Supervisor')).toBeDefined();
    });
  });

  it('should handle empty users list', async () => {
    mockAuthService.getAvailableUsers.mockResolvedValue([]);

    const { getByText } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByText('No hay usuarios disponibles')).toBeDefined();
    });
  });

  it('should clear error when user selects a different user', async () => {
    mockUseAuthStore.mockReturnValue({
      ...defaultAuthState,
      error: 'Previous error',
    });

    const { getByTestId } = render(
      <TestWrapper>
        <LoginScreen />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(getByTestId('user-selector')).toBeDefined();
    });

    const userButton = getByTestId('user-button-2');
    fireEvent.press(userButton);

    expect(mockClearError).toHaveBeenCalled();
  });
});