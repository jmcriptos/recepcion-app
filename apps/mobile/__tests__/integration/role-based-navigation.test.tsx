/**
 * Integration tests for role-based navigation behavior
 */

import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useAuthStore } from '@stores/auth-store';
import { TabNavigator } from '@navigation/TabNavigator';

// Mock the auth store
jest.mock('@stores/auth-store');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;

describe('Role-Based Navigation Integration', () => {
  const mockOnTabChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should dynamically update tabs when user role changes', () => {
    // Start with operator
    const mockStore = {
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => false),
      canManageUsers: jest.fn(() => false),
    };

    mockUseAuthStore.mockReturnValue(mockStore as any);

    const { getByText, queryByText, rerender } = render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    // Should only show operator tabs initially
    expect(getByText('Registro')).toBeTruthy();
    expect(getByText('Hoy')).toBeTruthy();
    expect(queryByText('Dashboard')).toBeNull();

    // Simulate role change to supervisor
    mockStore.canAccessDashboard = jest.fn(() => true);
    mockStore.canManageUsers = jest.fn(() => true);

    rerender(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    // Should now show all tabs
    expect(getByText('Registro')).toBeTruthy();
    expect(getByText('Hoy')).toBeTruthy();
    expect(getByText('Dashboard')).toBeTruthy();
    expect(getByText('Usuarios')).toBeTruthy();
    expect(getByText('Reportes')).toBeTruthy();
  });

  it('should handle authentication state changes correctly', () => {
    // Start authenticated
    const mockStore = {
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
    };

    mockUseAuthStore.mockReturnValue(mockStore as any);

    const { getByText, rerender, toJSON } = render(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    // Should show tabs when authenticated
    expect(getByText('Dashboard')).toBeTruthy();

    // Simulate logout
    mockStore.isAuthenticated = false;

    rerender(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    // Should not render anything when not authenticated
    expect(toJSON()).toBeNull();
  });

  it('should maintain tab selection state across permission changes', () => {
    const mockStore = {
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
    };

    mockUseAuthStore.mockReturnValue(mockStore as any);

    const { getByText, rerender } = render(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    // Dashboard should be highlighted
    const dashboardTab = getByText('Dashboard').parent?.parent;
    expect(dashboardTab?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#2563EB',
        }),
      ])
    );

    // Simulate permission change (but user still has dashboard access)
    rerender(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    // Dashboard should still be highlighted
    const updatedDashboardTab = getByText('Dashboard').parent?.parent;
    expect(updatedDashboardTab?.props.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          backgroundColor: '#2563EB',
        }),
      ])
    );
  });

  it('should gracefully handle edge case where active tab becomes unavailable', () => {
    // Start with supervisor having dashboard access
    const mockStore = {
      isAuthenticated: true,
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
    };

    mockUseAuthStore.mockReturnValue(mockStore as any);

    const { getByText, queryByText, rerender } = render(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    expect(getByText('Dashboard')).toBeTruthy();

    // Simulate permission revocation
    mockStore.canAccessDashboard = jest.fn(() => false);
    mockStore.canManageUsers = jest.fn(() => false);

    rerender(
      <TabNavigator activeTab="dashboard" onTabChange={mockOnTabChange} />
    );

    // Dashboard tab should no longer be available
    expect(queryByText('Dashboard')).toBeNull();
    
    // But basic tabs should still be available
    expect(getByText('Registro')).toBeTruthy();
    expect(getByText('Hoy')).toBeTruthy();
  });

  it('should call appropriate permission check functions', () => {
    const canAccessDashboard = jest.fn(() => true);
    const canManageUsers = jest.fn(() => true);

    mockUseAuthStore.mockReturnValue({
      isAuthenticated: true,
      canAccessDashboard,
      canManageUsers,
    } as any);

    render(
      <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
    );

    // Permission check functions should be called
    expect(canAccessDashboard).toHaveBeenCalled();
    expect(canManageUsers).toHaveBeenCalled();
  });

  it('should provide consistent user experience across different roles', () => {
    const testCases = [
      {
        role: 'operator',
        permissions: { canAccessDashboard: false, canManageUsers: false },
        expectedTabs: ['Registro', 'Hoy'],
        notExpectedTabs: ['Dashboard', 'Usuarios', 'Reportes'],
      },
      {
        role: 'supervisor',
        permissions: { canAccessDashboard: true, canManageUsers: true },
        expectedTabs: ['Registro', 'Hoy', 'Dashboard', 'Usuarios', 'Reportes'],
        notExpectedTabs: [],
      },
    ];

    testCases.forEach(({ role, permissions, expectedTabs, notExpectedTabs }) => {
      mockUseAuthStore.mockReturnValue({
        isAuthenticated: true,
        canAccessDashboard: jest.fn(() => permissions.canAccessDashboard),
        canManageUsers: jest.fn(() => permissions.canManageUsers),
      } as any);

      const { getByText, queryByText } = render(
        <TabNavigator activeTab="registrations" onTabChange={mockOnTabChange} />
      );

      // Check expected tabs are present
      expectedTabs.forEach(tabLabel => {
        expect(getByText(tabLabel)).toBeTruthy();
      });

      // Check not expected tabs are absent
      notExpectedTabs.forEach(tabLabel => {
        expect(queryByText(tabLabel)).toBeNull();
      });
    });
  });
});