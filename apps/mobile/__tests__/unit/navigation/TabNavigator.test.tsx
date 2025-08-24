/**
 * Unit tests for TabNavigator component with role-based access
 */

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { useAuthStore } from '@stores/auth-store';
import { TabNavigator } from '@navigation/TabNavigator';

// Mock the auth store
jest.mock('@stores/auth-store');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

describe('TabNavigator', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should not render when user is not authenticated', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      canAccessDashboard: jest.fn(() => false),
      canManageUsers: jest.fn(() => false),
    } as any);

    const { toJSON } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    expect(toJSON()).toBeNull();
  });

  it('should render only basic tabs for operator users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => false),
      canManageUsers: jest.fn(() => false),
    } as any);

    const { getByText, queryByText } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    // Should show basic tabs
    expect(getByText('Registro')).toBeTruthy();
    expect(getByText('Hoy')).toBeTruthy();

    // Should not show supervisor tabs
    expect(queryByText('Dashboard')).toBeNull();
    expect(queryByText('Usuarios')).toBeNull();
    expect(queryByText('Reportes')).toBeNull();
  });

  it('should render all tabs for supervisor users', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
    } as any);

    const { getByText } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    // Should show all tabs
    expect(getByText('Registro')).toBeTruthy();
    expect(getByText('Hoy')).toBeTruthy();
    expect(getByText('Dashboard')).toBeTruthy();
    expect(getByText('Usuarios')).toBeTruthy();
    expect(getByText('Reportes')).toBeTruthy();
  });

  it('should highlight the active tab correctly', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
    } as any);

    const { getByText } = render(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    const dashboardTab = getByText('Dashboard').parent?.parent;
    expect(dashboardTab?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#2563EB', // Active tab color
        }),
      ])
    );
  });

  it('should call onTabChange when a tab is pressed', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
    } as any);

    const { getByText } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    fireEvent.press(getByText('Dashboard'));

    expect(mockOnTabChange).toHaveBeenCalledWith('dashboard');
  });

  it('should have proper accessibility labels', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => false),
      canManageUsers: jest.fn(() => false),
    } as any);

    const { getByLabelText } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    expect(getByLabelText('Registro tab')).toBeTruthy();
    expect(getByLabelText('Hoy tab')).toBeTruthy();
  });

  it('should set accessibility state correctly for active tab', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => false),
      canManageUsers: jest.fn(() => false),
    } as any);

    const { getByLabelText } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    const activeTab = getByLabelText('Registro tab');
    expect(activeTab.props.accessibilityState).toEqual({ selected: true });

    const inactiveTab = getByLabelText('Hoy tab');
    expect(inactiveTab.props.accessibilityState).toEqual({ selected: false });
  });

  it('should handle partial supervisor permissions correctly', () => {
    // Test case where user can access dashboard but not manage users
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => false),
    } as any);

    const { getByText, queryByText } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    // Should show basic tabs and dashboard/reports
    expect(getByText('Registro')).toBeTruthy();
    expect(getByText('Hoy')).toBeTruthy();
    expect(getByText('Dashboard')).toBeTruthy();
    expect(getByText('Reportes')).toBeTruthy();

    // Should not show user management
    expect(queryByText('Usuarios')).toBeNull();
  });
});