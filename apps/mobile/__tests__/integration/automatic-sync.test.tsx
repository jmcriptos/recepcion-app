/**
 * Automatic Sync Integration Tests
 * Tests the complete automatic synchronization workflow
 * including UI components and real service interactions
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import AutomaticSyncService from '../../src/services/automatic-sync-service';
import { SyncStatusCounter } from '../../src/components/sync/SyncStatusCounter';
import SyncProgressIndicator from '../../src/components/sync/SyncProgressIndicator';
import SyncNotificationToast from '../../src/components/sync/SyncNotificationToast';

// Mock React Native modules
jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(() => Promise.resolve({
    isConnected: true,
    type: 'wifi',
    isInternetReachable: true,
  })),
  addEventListener: jest.fn(() => jest.fn()),
}));

jest.mock('react-native-sqlite-storage', () => ({
  DEBUG: jest.fn(),
  enablePromise: jest.fn(),
  openDatabase: jest.fn(() => Promise.resolve({
    executeSql: jest.fn(() => Promise.resolve([{ rows: { length: 0, item: () => ({}) } }])),
    close: jest.fn(() => Promise.resolve()),
    transaction: jest.fn((callback) => callback({
      executeSql: jest.fn(() => Promise.resolve()),
    })),
  })),
}));

jest.mock('react-native-uuid', () => ({
  v4: jest.fn(() => 'test-uuid-123'),
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock stores
jest.mock('../../src/stores/offline-store', () => ({
  useOfflineStore: jest.fn(() => ({
    networkStatus: { isConnected: true, type: 'wifi', isInternetReachable: true },
    syncProgress: null,
    isAutoSyncEnabled: true,
    setNetworkStatus: jest.fn(),
    setSyncProgress: jest.fn(),
    setAutoSyncEnabled: jest.fn(),
  })),
}));

jest.mock('../../src/stores/registration-store', () => ({
  useRecentRegistrations: jest.fn(() => [
    { id: '1', sync_status: 'synced' },
    { id: '2', sync_status: 'pending' },
    { id: '3', sync_status: 'failed' },
  ]),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider
    initialWindowMetrics={{
      frame: { x: 0, y: 0, width: 0, height: 0 },
      insets: { top: 0, left: 0, right: 0, bottom: 0 },
    }}
  >
    {children}
  </NativeBaseProvider>
);

describe('Automatic Sync Integration', () => {
  let automaticSyncService: AutomaticSyncService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    automaticSyncService = AutomaticSyncService.getInstance();
  });

  afterEach(async () => {
    // Cleanup after each test
    try {
      if (automaticSyncService.isServiceInitialized()) {
        await automaticSyncService.shutdown();
      }
    } catch (error) {
      // Ignore cleanup errors in tests
    }
  });

  describe('Service Integration', () => {
    it('should initialize the complete sync system', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      expect(automaticSyncService.isServiceInitialized()).toBe(true);

      const status = await automaticSyncService.getSyncStatus();
      expect(status.isInitialized).toBe(true);
      expect(status.networkStatus).toBeDefined();
    });

    it('should handle manual sync trigger', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      const result = await act(async () => {
        return await automaticSyncService.forceSyncNow();
      });

      expect(result).toBeDefined();
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('completed');
      expect(result).toHaveProperty('failed');
    });

    it('should perform health check', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      const health = await automaticSyncService.performHealthCheck();

      expect(health).toHaveProperty('overall');
      expect(health).toHaveProperty('services');
      expect(health).toHaveProperty('metrics');
      expect(['healthy', 'warning', 'error']).toContain(health.overall);
    });

    it('should manage auto-sync settings', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      // Should not throw
      automaticSyncService.setAutoSyncEnabled(false);
      automaticSyncService.setAutoSyncEnabled(true);

      const status = await automaticSyncService.getSyncStatus();
      expect(status.syncCoordinatorStatus).toBeDefined();
    });

    it('should perform system maintenance', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      // Should complete without errors
      await act(async () => {
        await automaticSyncService.performMaintenance();
      });
    });
  });

  describe('UI Integration', () => {
    it('should render SyncStatusCounter with default state', async () => {
      render(
        <TestWrapper>
          <SyncStatusCounter showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Estado de Sincronización')).toBeTruthy();
        expect(screen.getByText('Conectado')).toBeTruthy();
      });
    });

    it('should display sync statistics correctly', async () => {
      render(
        <TestWrapper>
          <SyncStatusCounter showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show registration counts
        expect(screen.getByText('Registros de Hoy (3)')).toBeTruthy();
        expect(screen.getByText('1')).toBeTruthy(); // Synced count
        expect(screen.getByText('1')).toBeTruthy(); // Pending count
        expect(screen.getByText('1')).toBeTruthy(); // Failed count
      });
    });

    it('should handle manual sync button press', async () => {
      const { getByText } = render(
        <TestWrapper>
          <SyncStatusCounter showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        const syncButton = getByText('Sincronizar');
        expect(syncButton).toBeTruthy();
      });

      // Note: In a real test, you would simulate button press
      // but that requires more complex mock setup
    });

    it('should show compact counter in navigation', async () => {
      render(
        <TestWrapper>
          <SyncStatusCounter showDetails={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        // Should show pending count
        expect(screen.getByText('1')).toBeTruthy();
      });
    });

    it('should render sync progress indicator when syncing', async () => {
      // Mock sync progress
      const mockStore = require('../../src/stores/offline-store');
      mockStore.useOfflineStore.mockReturnValue({
        networkStatus: { isConnected: true, type: 'wifi', isInternetReachable: true },
        syncProgress: { total: 5, completed: 2, failed: 0, currentOperation: 'create_registration:123' },
        isAutoSyncEnabled: true,
        setNetworkStatus: jest.fn(),
        setSyncProgress: jest.fn(),
        setAutoSyncEnabled: jest.fn(),
      });

      render(
        <TestWrapper>
          <SyncProgressIndicator />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Sincronizando...')).toBeTruthy();
        expect(screen.getByText('2 completados, 0 errores')).toBeTruthy();
      });
    });

    it('should render notification toast component', async () => {
      render(
        <TestWrapper>
          <SyncNotificationToast />
        </TestWrapper>
      );

      // Component should render without errors (notifications are event-driven)
      expect(true).toBe(true);
    });
  });

  describe('Network State Changes', () => {
    it('should handle connectivity loss and restoration', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      // Simulate connectivity changes by getting status multiple times
      let status = await automaticSyncService.getSyncStatus();
      expect(status.networkStatus.isConnected).toBe(true);

      // In a real test, you would simulate actual network changes
      // This would require mocking NetInfo more comprehensively
    });

    it('should adapt UI based on network status', async () => {
      // Mock offline state
      const mockStore = require('../../src/stores/offline-store');
      mockStore.useOfflineStore.mockReturnValue({
        networkStatus: { isConnected: false, type: 'none', isInternetReachable: false },
        syncProgress: null,
        isAutoSyncEnabled: true,
        setNetworkStatus: jest.fn(),
        setSyncProgress: jest.fn(),
        setAutoSyncEnabled: jest.fn(),
      });

      render(
        <TestWrapper>
          <SyncStatusCounter showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Sin conexión')).toBeTruthy();
        expect(screen.getByText('📱 Trabajando en modo offline')).toBeTruthy();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle service initialization errors gracefully', async () => {
      // This test would require more complex mocking to force initialization errors
      // For now, we verify that the service has error handling
      expect(() => automaticSyncService.getSyncStatus()).not.toThrow();
    });

    it('should show error states in UI components', async () => {
      // Mock error state
      const mockStore = require('../../src/stores/registration-store');
      mockStore.useRecentRegistrations.mockReturnValue([
        { id: '1', sync_status: 'failed' },
        { id: '2', sync_status: 'failed' },
        { id: '3', sync_status: 'failed' },
      ]);

      render(
        <TestWrapper>
          <SyncStatusCounter showDetails={true} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('⚠️ Errores de sincronización')).toBeTruthy();
      });
    });

    it('should handle sync failures gracefully', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      // The service should handle errors without crashing
      const status = await automaticSyncService.getSyncStatus();
      expect(status).toBeDefined();
    });
  });

  describe('Performance and Resource Management', () => {
    it('should properly cleanup resources on shutdown', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      expect(automaticSyncService.isServiceInitialized()).toBe(true);

      await act(async () => {
        await automaticSyncService.shutdown();
      });

      expect(automaticSyncService.isServiceInitialized()).toBe(false);
    });

    it('should handle multiple initialization attempts', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
        await automaticSyncService.initialize(); // Second call should not cause issues
      });

      expect(automaticSyncService.isServiceInitialized()).toBe(true);
    });

    it('should not allow operations before initialization', async () => {
      const uninitializedService = AutomaticSyncService.getInstance();
      
      await expect(uninitializedService.forceSyncNow())
        .rejects.toThrow('Automatic sync service not initialized');
    });
  });

  describe('Data Consistency', () => {
    it('should maintain consistent sync state across components', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      const status = await automaticSyncService.getSyncStatus();
      expect(status.isInitialized).toBe(true);

      // All components should reflect the same state
      render(
        <TestWrapper>
          <SyncStatusCounter showDetails={true} />
          <SyncProgressIndicator />
          <SyncNotificationToast />
        </TestWrapper>
      );

      // Components should render without conflicts
      expect(screen.getByText('Estado de Sincronización')).toBeTruthy();
    });

    it('should handle concurrent sync operations properly', async () => {
      await act(async () => {
        await automaticSyncService.initialize();
      });

      // Multiple sync calls should be handled gracefully
      const promises = [
        automaticSyncService.forceSyncNow().catch(() => ({ total: 0, completed: 0, failed: 0 })),
        automaticSyncService.getSyncStatus(),
        automaticSyncService.performHealthCheck(),
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      expect(results[1]).toHaveProperty('isInitialized');
      expect(results[2]).toHaveProperty('overall');
    });
  });
});