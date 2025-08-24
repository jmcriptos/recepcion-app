/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor, screen } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { ManualSyncControls } from '../../../src/components/sync/ManualSyncControls';
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

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <NativeBaseProvider>
      {component}
    </NativeBaseProvider>
  );
};

describe('ManualSyncControls', () => {
  const mockSyncQueueInstance = {
    getQueueStats: jest.fn(),
  };

  const mockAutomaticSyncInstance = {
    forceSyncNow: jest.fn(),
  };

  const mockOnSyncStarted = jest.fn();
  const mockOnSyncCompleted = jest.fn();
  const mockOnSyncError = jest.fn();

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

    // Mock service methods
    mockSyncQueueInstance.getQueueStats.mockResolvedValue({
      totalPending: 3,
      byType: {
        create_registration: 2,
        upload_photo: 1,
        update_user: 0,
      },
      highPriority: 2,
      failedOperations: 1,
    });
  });

  describe('Component Rendering', () => {
    it('should render manual sync controls for supervisors', async () => {
      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('🔄 Control Manual de Sync')).toBeTruthy();
        expect(screen.getByText('Supervisor')).toBeTruthy();
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });
    });

    it('should show different sizes correctly', async () => {
      const { rerender } = renderWithProviders(<ManualSyncControls size="sm" />);
      
      await waitFor(() => {
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });

      rerender(
        <NativeBaseProvider>
          <ManualSyncControls size="lg" />
        </NativeBaseProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });
    });

    it('should hide queue stats when showQueueStats is false', async () => {
      renderWithProviders(<ManualSyncControls showQueueStats={false} />);
      
      await waitFor(() => {
        expect(screen.getByText('🔄 Control Manual de Sync')).toBeTruthy();
        expect(screen.queryByText('Estado de la Cola')).toBeNull();
      });
    });
  });

  describe('Supervisor Role Validation', () => {
    it('should show access denied for non-supervisors', async () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        isSupervisor: jest.fn(() => false),
        user: { id: '1', name: 'Test User', role: 'operator' },
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Solo los supervisores pueden usar la sincronización manual')).toBeTruthy();
      });

      // Force sync button should be disabled
      const forceButton = screen.getByText('Forzar Sincronización');
      fireEvent.press(forceButton);
      
      // Should not trigger sync
      expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
    });

    it('should prevent non-supervisor sync attempts', async () => {
      mockUseAuthStore.mockReturnValue({
        ...mockUseAuthStore(),
        isSupervisor: jest.fn(() => false),
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
    });
  });

  describe('Network Status Handling', () => {
    it('should disable sync when offline', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sin conexión a internet - La sincronización manual no está disponible')).toBeTruthy();
      });

      const forceButton = screen.getByText('Forzar Sincronización');
      fireEvent.press(forceButton);
      
      expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
    });

    it('should show offline warning message', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        networkStatus: {
          isConnected: false,
          type: 'none',
          isInternetReachable: false,
        },
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sin conexión a internet - La sincronización manual no está disponible')).toBeTruthy();
      });
    });
  });

  describe('Manual Sync Operation', () => {
    it('should show confirmation dialog before sync', async () => {
      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        expect(screen.getByText('Confirmar Sincronización Manual')).toBeTruthy();
        expect(screen.getByText('¿Estás seguro de que quieres forzar una sincronización manual?')).toBeTruthy();
        expect(screen.getByText('Confirmar Sincronización')).toBeTruthy();
        expect(screen.getByText('Cancelar')).toBeTruthy();
      });
    });

    it('should cancel sync on confirmation dialog cancel', async () => {
      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const cancelButton = screen.getByText('Cancelar');
        fireEvent.press(cancelButton);
      });

      expect(mockAutomaticSyncInstance.forceSyncNow).not.toHaveBeenCalled();
    });

    it('should execute sync on confirmation', async () => {
      mockAutomaticSyncInstance.forceSyncNow.mockResolvedValue({
        total: 3,
        completed: 3,
        failed: 0,
      });

      renderWithProviders(
        <ManualSyncControls 
          onSyncStarted={mockOnSyncStarted}
          onSyncCompleted={mockOnSyncCompleted}
        />
      );
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByText('Confirmar Sincronización');
        fireEvent.press(confirmButton);
      });

      await waitFor(() => {
        expect(mockOnSyncStarted).toHaveBeenCalled();
        expect(mockAutomaticSyncInstance.forceSyncNow).toHaveBeenCalled();
        expect(mockOnSyncCompleted).toHaveBeenCalledWith({
          total: 3,
          completed: 3,
          failed: 0,
        });
      });
    });

    it('should handle sync errors', async () => {
      const syncError = new Error('Sync operation failed');
      mockAutomaticSyncInstance.forceSyncNow.mockRejectedValue(syncError);

      renderWithProviders(
        <ManualSyncControls 
          onSyncError={mockOnSyncError}
        />
      );
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByText('Confirmar Sincronización');
        fireEvent.press(confirmButton);
      });

      await waitFor(() => {
        expect(mockOnSyncError).toHaveBeenCalledWith('Sync operation failed');
      });
    });

    it('should prevent multiple simultaneous syncs', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        syncProgress: {
          total: 5,
          completed: 2,
          failed: 0,
          currentOperation: 'create_registration:reg-123',
        },
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sincronización Activa')).toBeTruthy();
        expect(screen.getByText('2/5')).toBeTruthy();
      });

      const forceButton = screen.getByText('Sincronización Activa');
      fireEvent.press(forceButton);
      
      // Should show warning instead of confirmation dialog
      expect(screen.queryByText('Confirmar Sincronización Manual')).toBeNull();
    });
  });

  describe('Sync Progress Display', () => {
    it('should show sync progress when active', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        syncProgress: {
          total: 10,
          completed: 4,
          failed: 1,
          currentOperation: 'upload_photo:photo-456',
        },
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sincronización en Progreso')).toBeTruthy();
        expect(screen.getByText('4/10')).toBeTruthy();
        expect(screen.getByText('upload_photo:photo-456')).toBeTruthy();
      });
    });

    it('should update button text during sync', async () => {
      const { rerender } = renderWithProviders(<ManualSyncControls />);
      
      // Initially should show normal button
      await waitFor(() => {
        expect(screen.getByText('Forzar Sincronización')).toBeTruthy();
      });

      // Mock sync in progress
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        syncProgress: {
          total: 5,
          completed: 2,
          failed: 0,
        },
      });

      rerender(
        <NativeBaseProvider>
          <ManualSyncControls />
        </NativeBaseProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText('Sincronización Activa')).toBeTruthy();
      });
    });
  });

  describe('Queue Statistics Display', () => {
    it('should display queue statistics when enabled', async () => {
      renderWithProviders(<ManualSyncControls showQueueStats={true} />);
      
      await waitFor(() => {
        expect(screen.getByText('Estado de la Cola')).toBeTruthy();
        expect(screen.getByText('3')).toBeTruthy(); // totalPending
        expect(screen.getByText('1')).toBeTruthy(); // failedOperations
        expect(screen.getByText('2')).toBeTruthy(); // create_registration
        expect(screen.getByText('Pendientes')).toBeTruthy();
        expect(screen.getByText('Fallidos')).toBeTruthy();
        expect(screen.getByText('Registros')).toBeTruthy();
      });
    });

    it('should show queue info in confirmation dialog', async () => {
      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        expect(screen.getByText('📋 Elementos en Cola')).toBeTruthy();
        expect(screen.getByText(/Hay 3 elementos pendientes de sincronización/)).toBeTruthy();
      });
    });
  });

  describe('Auto Sync Status Display', () => {
    it('should show auto sync enabled status', async () => {
      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sync Automático:')).toBeTruthy();
        expect(screen.getByText('Activado')).toBeTruthy();
      });
    });

    it('should show auto sync disabled status', async () => {
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        isAutoSyncEnabled: false,
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        expect(screen.getByText('Sync Automático:')).toBeTruthy();
        expect(screen.getByText('Desactivado')).toBeTruthy();
      });
    });
  });

  describe('Last Sync Result Display', () => {
    it('should show last sync result after successful sync', async () => {
      mockAutomaticSyncInstance.forceSyncNow.mockResolvedValue({
        total: 5,
        completed: 4,
        failed: 1,
      });

      renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByText('Confirmar Sincronización');
        fireEvent.press(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText('✅ Última Sincronización Manual')).toBeTruthy();
        expect(screen.getByText('4 completados, 1 fallidos')).toBeTruthy();
      });
    });

    it('should hide last sync result during active sync', async () => {
      // First complete a sync to set lastSyncResult
      mockAutomaticSyncInstance.forceSyncNow.mockResolvedValue({
        total: 3,
        completed: 3,
        failed: 0,
      });

      const { rerender } = renderWithProviders(<ManualSyncControls />);
      
      await waitFor(() => {
        const forceButton = screen.getByText('Forzar Sincronización');
        fireEvent.press(forceButton);
      });

      await waitFor(() => {
        const confirmButton = screen.getByText('Confirmar Sincronización');
        fireEvent.press(confirmButton);
      });

      await waitFor(() => {
        expect(screen.getByText('✅ Última Sincronización Manual')).toBeTruthy();
      });

      // Now simulate active sync
      mockUseOfflineStore.mockReturnValue({
        ...mockUseOfflineStore(),
        syncProgress: {
          total: 5,
          completed: 2,
          failed: 0,
        },
      });

      rerender(
        <NativeBaseProvider>
          <ManualSyncControls />
        </NativeBaseProvider>
      );
      
      await waitFor(() => {
        expect(screen.queryByText('✅ Última Sincronización Manual')).toBeNull();
        expect(screen.getByText('Sincronización en Progreso')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle queue stats loading errors gracefully', async () => {
      mockSyncQueueInstance.getQueueStats.mockRejectedValue(new Error('Database error'));

      renderWithProviders(<ManualSyncControls />);
      
      // Should still render the component
      await waitFor(() => {
        expect(screen.getByText('🔄 Control Manual de Sync')).toBeTruthy();
      });
    });
  });
});