/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor, screen, act } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { SyncStatusDashboardScreen } from '../../src/screens/dashboard/SyncStatusDashboardScreen';
import { ManualSyncControls } from '../../src/components/sync/ManualSyncControls';
import { useAuthStore } from '../../src/stores/auth-store';
import { useOfflineStore } from '../../src/stores/offline-store';
import AutomaticSyncService from '../../src/services/automatic-sync-service';
import SyncQueueService from '../../src/services/sync-queue-service';

// Mock dependencies
jest.mock('../../src/stores/auth-store');
jest.mock('../../src/stores/offline-store');
jest.mock('../../src/services/automatic-sync-service');
jest.mock('../../src/services/sync-queue-service');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseOfflineStore = useOfflineStore as jest.MockedFunction<typeof useOfflineStore>;
const mockAutomaticSyncService = AutomaticSyncService as jest.MockedClass<typeof AutomaticSyncService>;
const mockSyncQueueService = SyncQueueService as jest.MockedClass<typeof SyncQueueService>;

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <NativeBaseProvider>
      {component}
    </NativeBaseProvider>
  );
};

describe('Manual Sync Controls Integration', () => {
  const mockSyncQueueInstance = {
    getQueueStats: jest.fn(),
    getSyncErrors: jest.fn(),
    retryFailedOperation: jest.fn(),
    clearError: jest.fn(),
    processQueue: jest.fn(),
  };

  const mockAutomaticSyncInstance = {
    forceSyncNow: jest.fn(),
    retryFailedOperation: jest.fn(),
    clearSyncError: jest.fn(),
    getSyncDashboardData: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock supervisor user
    mockUseAuthStore.mockReturnValue({
      isSupervisor: jest.fn(() => true),
      isAuthenticated: true,
      user: { id: '1', name: 'Test Supervisor', role: 'supervisor' },
      login: jest.fn(),
      logout: jest.fn(),
      initializeSession: jest.fn(),
      clearError: jest.fn(),
      extendSession: jest.fn(),
      handleSessionExpired: jest.fn(),
      handleSessionWarning: jest.fn(),
      dismissSessionWarning: jest.fn(),
      canAccessDashboard: jest.fn(() => true),
      canManageUsers: jest.fn(() => true),
      isLoading: false,
      error: null,
      sessionWarning: { show: false, remainingTime: 0 },
    });

    // Mock online state
    mockUseOfflineStore.mockReturnValue({
      networkStatus: {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      },
      syncProgress: null,
      isAutoSyncEnabled: true,
      lastSyncTime: null,
      isInitialized: true,
      dbStats: null,
      showOfflineIndicator: false,
      offlineMode: false,
      setNetworkStatus: jest.fn(),
      setInitialized: jest.fn(),
      setSyncProgress: jest.fn(),
      setAutoSyncEnabled: jest.fn(),
      setLastSyncTime: jest.fn(),
      setDbStats: jest.fn(),
      setShowOfflineIndicator: jest.fn(),
      setOfflineMode: jest.fn(),
      reset: jest.fn(),
    });

    // Mock service instances
    mockSyncQueueService.getInstance = jest.fn(() => mockSyncQueueInstance as any);
    mockAutomaticSyncService.getInstance = jest.fn(() => mockAutomaticSyncInstance as any);

    // Mock default service responses
    mockSyncQueueInstance.getQueueStats.mockResolvedValue({
      totalPending: 5,
      byType: {
        create_registration: 3,
        upload_photo: 1,
        update_user: 1,
      },
      highPriority: 3,
      failedOperations: 2,
    });

    mockSyncQueueInstance.getSyncErrors.mockResolvedValue([
      {
        id: 'error-1',
        operation_type: 'create_registration',
        entity_id: 'reg-123',
        error_message: 'Network timeout during upload',
        error_category: 'network',
        retry_count: 1,
        max_retries: 5,
        last_attempt_at: '2023-01-01T10:15:00Z',
        created_at: '2023-01-01T10:00:00Z',
        can_retry: true,
      },
      {
        id: 'error-2',
        operation_type: 'upload_photo',
        entity_id: 'reg-456',
        error_message: 'Invalid file format',
        error_category: 'validation',
        retry_count: 3,
        max_retries: 5,
        last_attempt_at: '2023-01-01T10:20:00Z',
        created_at: '2023-01-01T10:05:00Z',
        can_retry: false,
      },
    ]);
  });

  describe('Complete Manual Sync Workflow', () => {
    it('should perform complete manual sync flow from dashboard', async () => {
      mockAutomaticSyncInstance.forceSyncNow.mockResolvedValue({
        total: 5,
        completed: 4,
        failed: 1,
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard de Sincronización')).toBeTruthy();
        expect(screen.getByText('🔄 Controles de Sincronización')).toBeTruthy();
      });

      // Verify queue stats are displayed
      await waitFor(() => {
        expect(screen.getByText('📊 Estadísticas de Cola')).toBeTruthy();
        expect(screen.getByText('5')).toBeTruthy(); // totalPending
        expect(screen.getByText('2')).toBeTruthy(); // failedOperations
      });

      // Verify errors are displayed
      await waitFor(() => {
        expect(screen.getByText('❌ Errores de Sincronización (2)')).toBeTruthy();
        expect(screen.getByText('Network timeout during upload')).toBeTruthy();
        expect(screen.getByText('Invalid file format')).toBeTruthy();
      });

      // Trigger manual sync
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      // Should start sync process
      await waitFor(() => {
        expect(mockAutomaticSyncInstance.forceSyncNow).toHaveBeenCalled();
      });

      // Should refresh data after sync
      await waitFor(() => {
        expect(mockSyncQueueInstance.getQueueStats).toHaveBeenCalledTimes(2); // Initial + refresh
        expect(mockSyncQueueInstance.getSyncErrors).toHaveBeenCalledTimes(2); // Initial + refresh
      });
    });

    it('should handle sync progress updates during manual sync', async () => {
      let syncProgressCallback: ((progress: any) => void) | null = null;
      
      mockAutomaticSyncInstance.forceSyncNow.mockImplementation(() => {
        return new Promise((resolve) => {
          // Simulate sync progress
          setTimeout(() => {
            if (syncProgressCallback) {
              syncProgressCallback({
                total: 5,
                completed: 2,
                failed: 0,
                currentOperation: 'create_registration:reg-123',
              });
            }
          }, 100);
          
          setTimeout(() => {
            if (syncProgressCallback) {
              syncProgressCallback({
                total: 5,
                completed: 4,
                failed: 1,
              });
            }
            resolve({
              total: 5,
              completed: 4,
              failed: 1,
            });
          }, 200);
        });
      });

      const onSyncStarted = jest.fn();
      const onSyncCompleted = jest.fn();

      renderWithProviders(
        <ManualSyncControls 
          onSyncStarted={onSyncStarted}
          onSyncCompleted={onSyncCompleted}
        />
      );
      
      // Wait for initial render
      await waitFor(() => {
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });

      // Start manual sync
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByText('Confirmar Sincronización');
        fireEvent.press(confirmButton);
      });

      // Should call onSyncStarted
      await waitFor(() => {
        expect(onSyncStarted).toHaveBeenCalled();
      });

      // Should complete sync and call onSyncCompleted
      await waitFor(() => {
        expect(onSyncCompleted).toHaveBeenCalledWith({
          total: 5,
          completed: 4,
          failed: 1,
        });
      });
    });
  });

  describe('Error Retry Integration', () => {
    it('should handle individual error retry from dashboard', async () => {
      mockAutomaticSyncInstance.retryFailedOperation.mockResolvedValue();
      
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      // Wait for errors to load
      await waitFor(() => {
        expect(screen.getByText('❌ Errores de Sincronización (2)')).toBeTruthy();
      });

      // Find and click retry button for the first error (network error - can retry)
      const retryButtons = screen.getAllByText('Reintentar');
      expect(retryButtons.length).toBeGreaterThan(0);
      
      fireEvent.press(retryButtons[0]);

      // Should call retry method
      await waitFor(() => {
        expect(mockAutomaticSyncInstance.retryFailedOperation).toHaveBeenCalledWith('error-1');
      });

      // Should refresh data after retry
      await waitFor(() => {
        expect(mockSyncQueueInstance.getSyncErrors).toHaveBeenCalledTimes(2);
      });
    });

    it('should not show retry button for non-retryable errors', async () => {
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Errores de Sincronización (2)')).toBeTruthy();
        expect(screen.getByText('Invalid file format')).toBeTruthy();
      });

      // Should only show 1 retry button (for the network error, not validation error)
      const retryButtons = screen.getAllByText('Reintentar');
      expect(retryButtons).toHaveLength(1);
    });

    it('should handle retry failures gracefully', async () => {
      mockAutomaticSyncInstance.retryFailedOperation.mockRejectedValue(
        new Error('Retry operation failed')
      );
      
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Reintentar');
        fireEvent.press(retryButton);
      });

      await waitFor(() => {
        expect(mockAutomaticSyncInstance.retryFailedOperation).toHaveBeenCalled();
        // Should not crash on retry failure
        expect(screen.getByText('📊 Dashboard de Sincronización')).toBeTruthy();
      });
    });
  });

  describe('Offline Mode Integration', () => {
    it('should handle transition from online to offline during sync', async () => {
      const { rerender } = renderWithProviders(<ManualSyncControls />);
      
      // Initially online
      await waitFor(() => {
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
        expect(screen.queryByText('Sin conexión a internet')).toBeNull();
      });

      // Simulate going offline
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      rerender(
        <NativeBaseProvider>
          <ManualSyncControls />
        </NativeBaseProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Sin conexión a internet - La sincronización manual no está disponible')).toBeTruthy();
      });

      // Button should still exist but sync should be disabled
      const forceButton = screen.getByText('Forzar Sincronización');
      fireEvent.press(forceButton);
      
      // Should not start sync when offline
      expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
    });

    it('should resume sync capability when coming back online', async () => {
      // Start offline
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      const { rerender } = renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sin conexión a internet - La sincronización manual no está disponible')).toBeTruthy();
      });

      // Come back online
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: true,
          type: 'wifi',
          isInternetReachable: true,
        },
      });

      rerender(
        <NativeBaseProvider>
          <ManualSyncControls />
        </NativeBaseProvider>
      );
      
      await waitFor(() => {
        expect(screen.queryByText('Sin conexión a internet')).toBeNull();
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });

      // Should be able to sync again
      const forceButton = screen.getByText('Forzar Sincronización');
      expect(forceButton).toBeTruthy();
    });
  });

  describe('Supervisor Permission Integration', () => {
    it('should handle role change from supervisor to operator', async () => {
      const { rerender } = renderWithProviders(<ManualSyncControls />);
      
      // Initially supervisor
      await waitFor(() => {
        expect(screen.getByText('Supervisor')).toBeTruthy();
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });

      // Change to operator role
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        isSupervisor: jest.fn(() => false),
        user: { id: '1', name: 'Test User', role: 'operator' },
        canAccessDashboard: jest.fn(() => false),
      });

      rerender(
        <NativeBaseProvider>
          <ManualSyncControls />
        </NativeBaseProvider>
      );
      
      await waitFor(() => {
        expect(screen.queryByText('Supervisor')).toBeNull();
        expect(screen.getByText('Solo los supervisores pueden usar la sincronización manual')).toBeTruthy();
      });

      // Sync button should be disabled
      const forceButton = screen.getByText('Forzar Sincronización');
      fireEvent.press(forceButton);
      
      expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
    });

    it('should deny dashboard access for non-supervisors', async () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        isSupervisor: jest.fn(() => false),
        canAccessDashboard: jest.fn(() => false),
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Acceso denegado')).toBeTruthy();
        expect(screen.getByText('Solo los supervisores pueden acceder al dashboard de sincronización')).toBeTruthy();
        expect(screen.queryByText('📊 Dashboard de Sincronización')).toBeNull();
      });
    });
  });

  describe('Real-time Data Updates', () => {
    it('should refresh data after successful manual sync', async () => {
      mockAutomaticSyncInstance.forceSyncNow.mockResolvedValue({
        total: 5,
        completed: 5,
        failed: 0,
      });

      // Mock updated stats after sync
      const updatedStats = {
        totalPending: 0,
        byType: {
          create_registration: 0,
          upload_photo: 0,
          update_user: 0,
        },
        highPriority: 0,
        failedOperations: 0,
      };

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      // Wait for initial load
      await waitFor(() => {
        expect(screen.getByText('5')).toBeTruthy(); // Initial pending count
      });

      // Trigger manual sync
      const forceButton = screen.getByText('Forzar Sincronización');
      fireEvent.press(forceButton);

      // Mock updated response for refresh
      mockSyncQueueInstance.getQueueStats.mockResolvedValueOnce(updatedStats);
      mockSyncQueueInstance.getSyncErrors.mockResolvedValueOnce([]);

      await waitFor(() => {
        expect(mockAutomaticSyncInstance.forceSyncNow).toHaveBeenCalled();
      });

      // Should refresh and show updated stats
      await waitFor(() => {
        expect(mockSyncQueueInstance.getQueueStats).toHaveBeenCalledTimes(2);
      });
    });

    it('should handle data refresh failures gracefully', async () => {
      mockSyncQueueInstance.getQueueStats.mockRejectedValueOnce(new Error('Database error'));
      mockSyncQueueInstance.getSyncErrors.mockRejectedValueOnce(new Error('Query failed'));

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      // Should still render the component despite data loading errors
      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard de Sincronización')).toBeTruthy();
      });

      // Component should remain functional
      const forceButton = screen.getByText('Forzar Sincronización');
      expect(forceButton).toBeTruthy();
    });
  });

  describe('Edge Cases and Error Scenarios', () => {
    it('should handle service initialization failures', async () => {
      mockAutomaticSyncService.getInstance.mockImplementation(() => {
        throw new Error('Service not initialized');
      });

      // Should not crash during render
      expect(() => {
        renderWithProviders(<ManualSyncControls />);
      }).not.toThrow();
    });

    it('should handle empty queue stats gracefully', async () => {
      mockSyncQueueInstance.getQueueStats.mockResolvedValue({
        totalPending: 0,
        byType: {
          create_registration: 0,
          upload_photo: 0,
          update_user: 0,
        },
        highPriority: 0,
        failedOperations: 0,
      });

      mockSyncQueueInstance.getSyncErrors.mockResolvedValue([]);

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('📊 Estadísticas de Cola')).toBeTruthy();
        expect(screen.getByText('0')).toBeTruthy(); // Should show 0 for empty stats
      });
    });

    it('should handle concurrent sync attempts', async () => {
      mockAutomaticSyncInstance.forceSyncNow
        .mockResolvedValueOnce({
          total: 3,
          completed: 3,
          failed: 0,
        })
        .mockResolvedValueOnce({
          total: 2,
          completed: 2,
          failed: 0,
        });

      renderWithProviders(<ManualSyncControls />);
      
      // Start first sync
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByText('Confirmar Sincronización');
        fireEvent.press(confirmButton);
      });

      // Try to start second sync immediately
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      // Should only have one sync call since second should be prevented during first
      await waitFor(() => {
        expect(mockAutomaticSyncInstance.forceSyncNow).toHaveBeenCalledTimes(1);
      });
    });
  });
});