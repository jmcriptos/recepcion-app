/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { SyncStatusDashboardScreen } from '../../../src/screens/dashboard/SyncStatusDashboardScreen';
import { useAuthStore } from '../../../src/stores/auth-store';
import { useOfflineStore } from '../../../src/stores/offline-store';
import AutomaticSyncService from '../../../src/services/automatic-sync-service';
import SyncQueueService from '../../../src/services/sync-queue-service';

// Mock dependencies
jest.mock('../../../src/stores/auth-store');
jest.mock('../../../src/stores/offline-store');
jest.mock('../../../src/services/automatic-sync-service');
jest.mock('../../../src/services/sync-queue-service');

const mockUseAuthStore = useAuthStore as jest.MockedFunction<typeof useAuthStore>;
const mockUseOfflineStore = useOfflineStore as jest.MockedFunction<typeof useOfflineStore>;
const mockAutomaticSyncService = AutomaticSyncService as jest.MockedClass<typeof AutomaticSyncService>;
const mockSyncQueueService = SyncQueueService as jest.MockedClass<typeof SyncQueueService>;

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
  }),
}));

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <NativeBaseProvider>
      {component}
    </NativeBaseProvider>
  );
};

describe('SyncStatusDashboardScreen', () => {
  const mockSyncQueueInstance = {
    getQueueStats: jest.fn(),
    getSyncErrors: jest.fn(),
    retryFailedOperation: jest.fn(),
    clearError: jest.fn(),
  };

  const mockAutomaticSyncInstance = {
    forceSyncNow: jest.fn(),
    retryFailedOperation: jest.fn(),
    clearSyncError: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock store returns
    mockUseAuthStore.mockReturnValue({
      isSupervisor: jest.fn(() => true),
      isAuthenticated: true,
      user: { id: '1', name: 'Test User', role: 'supervisor' },
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

    mockUseOfflineStore.mockReturnValue({
      networkStatus: {
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      },
      syncProgress: null,
      isAutoSyncEnabled: true,
      lastSyncTime: '2023-01-01T10:00:00Z',
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

    // Mock service methods
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
        error_message: 'Network timeout',
        error_category: 'network',
        retry_count: 2,
        max_retries: 5,
        last_attempt_at: '2023-01-01T09:30:00Z',
        created_at: '2023-01-01T09:00:00Z',
        can_retry: true,
      },
    ]);
  });

  describe('Supervisor Access Control', () => {
    it('should show dashboard for supervisors', async () => {
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard de Sincronización')).toBeTruthy();
        expect(screen.getByText('🔄 Controles de Sincronización')).toBeTruthy();
      });
    });

    it('should deny access for non-supervisors', async () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        isSupervisor: jest.fn(() => false),
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Acceso denegado')).toBeTruthy();
        expect(screen.getByText('Solo los supervisores pueden acceder al dashboard de sincronización')).toBeTruthy();
      });
    });
  });

  describe('Manual Sync Controls', () => {
    it('should allow force sync when connected and supervisor', async () => {
      mockAutomaticSyncInstance.forceSyncNow.mockResolvedValue({
        total: 5,
        completed: 4,
        failed: 1,
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        expect(forceButton).toBeTruthy();
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        expect(mockAutomaticSyncInstance.forceSyncNow).toHaveBeenCalled();
      });
    });

    it('should disable force sync when offline', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        expect(forceButton).toBeTruthy();
        // Button should be disabled when offline
        fireEvent.press(forceButton);
        // Should show offline warning instead of syncing
        expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
      });
    });

    it('should show sync progress during active sync', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        syncProgress: {
          total: 10,
          completed: 3,
          failed: 0,
          currentOperation: 'create_registration:reg-123',
        },
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Sincronizando...')).toBeTruthy();
        expect(screen.getByText('3/10')).toBeTruthy();
      });
    });
  });

  describe('Error Display and Retry', () => {
    it('should display sync errors with retry options', async () => {
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Errores de Sincronización (1)')).toBeTruthy();
        expect(screen.getByText('Crear Registro')).toBeTruthy();
        expect(screen.getByText('ID: reg-123')).toBeTruthy();
        expect(screen.getByText('2/5')).toBeTruthy();
        expect(screen.getByText('Reintentar')).toBeTruthy();
      });
    });

    it('should handle retry failed operation', async () => {
      mockAutomaticSyncInstance.retryFailedOperation.mockResolvedValue();

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        const retryButton = screen.getByText('Reintentar');
        fireEvent.press(retryButton);
      });

      await waitFor(() => {
        expect(mockAutomaticSyncInstance.retryFailedOperation).toHaveBeenCalledWith('error-1');
      });
    });

    it('should categorize errors correctly', async () => {
      const networkError = {
        id: 'error-network',
        operation_type: 'create_registration',
        entity_id: 'reg-456',
        error_message: 'Connection timeout',
        error_category: 'network' as const,
        retry_count: 1,
        max_retries: 5,
        can_retry: true,
        created_at: '2023-01-01T09:00:00Z',
      };

      const validationError = {
        id: 'error-validation',
        operation_type: 'create_registration',
        entity_id: 'reg-789',
        error_message: 'Invalid weight value',
        error_category: 'validation' as const,
        retry_count: 3,
        max_retries: 5,
        can_retry: false,
        created_at: '2023-01-01T09:15:00Z',
      };

      mockSyncQueueInstance.getSyncErrors.mockResolvedValue([networkError, validationError]);

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('❌ Errores de Sincronización (2)')).toBeTruthy();
        // Network error should show retry button
        expect(screen.getByText('Reintentar')).toBeTruthy();
        // Should show both error types
        expect(screen.getAllByText('Crear Registro')).toHaveLength(2);
      });
    });
  });

  describe('Queue Statistics', () => {
    it('should display queue statistics correctly', async () => {
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('📊 Estadísticas de Cola')).toBeTruthy();
        expect(screen.getByText('5')).toBeTruthy(); // totalPending
        expect(screen.getByText('2')).toBeTruthy(); // failedOperations
        expect(screen.getByText('3')).toBeTruthy(); // registrations
        expect(screen.getByText('Pendientes')).toBeTruthy();
        expect(screen.getByText('Fallidos')).toBeTruthy();
        expect(screen.getByText('Registros')).toBeTruthy();
      });
    });

    it('should show warning for offline with pending items', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('⚠️ Elementos en Cola')).toBeTruthy();
      });
    });
  });

  describe('System Health Status', () => {
    it('should show healthy status with good conditions', async () => {
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Sistema Saludable')).toBeTruthy();
      });
    });

    it('should show warning status for offline with pending items', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Advertencias')).toBeTruthy();
      });
    });

    it('should show error status for many failed operations', async () => {
      mockSyncQueueInstance.getQueueStats.mockResolvedValue({
        totalPending: 15,
        byType: {
          create_registration: 10,
          upload_photo: 3,
          update_user: 2,
        },
        highPriority: 10,
        failedOperations: 8, // More than 5, should trigger error status
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Errores Críticos')).toBeTruthy();
      });
    });
  });

  describe('Real-time Updates', () => {
    it('should refresh data when pull to refresh is triggered', async () => {
      renderWithProviders(<SyncStatusDashboardScreen />);
      
      // Initial load
      await waitFor(() => {
        expect(mockSyncQueueInstance.getQueueStats).toHaveBeenCalledTimes(1);
        expect(mockSyncQueueInstance.getSyncErrors).toHaveBeenCalledTimes(1);
      });

      // Simulate pull to refresh
      const scrollView = screen.getByTestId('sync-dashboard-scroll') || screen.getByLabelText('sync-dashboard');
      if (scrollView) {
        fireEvent(scrollView, 'refresh');
        
        await waitFor(() => {
          expect(mockSyncQueueInstance.getQueueStats).toHaveBeenCalledTimes(2);
          expect(mockSyncQueueInstance.getSyncErrors).toHaveBeenCalledTimes(2);
        });
      }
    });

    it('should update last sync time when provided', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        lastSyncTime: '2023-01-01T14:30:00Z',
      });

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        expect(screen.getByText('Última Sync:')).toBeTruthy();
        // Should show formatted date
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockSyncQueueInstance.getQueueStats.mockRejectedValue(new Error('Service unavailable'));
      mockSyncQueueInstance.getSyncErrors.mockRejectedValue(new Error('Database error'));

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      // Should not crash and should render basic UI
      await waitFor(() => {
        expect(screen.getByText('📊 Dashboard de Sincronización')).toBeTruthy();
      });
    });

    it('should handle force sync errors', async () => {
      mockAutomaticSyncInstance.forceSyncNow.mockRejectedValue(new Error('Sync failed'));

      renderWithProviders(<SyncStatusDashboardScreen />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        expect(mockAutomaticSyncInstance.forceSyncNow).toHaveBeenCalled();
        // Should show error toast (difficult to test toast directly)
      });
    });
  });
});