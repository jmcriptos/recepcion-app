/**
 * Automatic Sync Service Tests
 * Comprehensive unit tests for automatic sync functionality
 */

import AutomaticSyncService from '../../src/services/automatic-sync-service';
import ConnectionService from '../../src/services/connection-service';
import BackgroundSyncCoordinator from '../../src/services/background-sync-coordinator';
import SyncQueueService from '../../src/services/sync-queue-service';
import SyncNotificationService from '../../src/services/sync-notification-service';
import OfflineStorageService from '../../src/services/offline-storage';

// Mock all dependencies
jest.mock('../../src/services/connection-service');
jest.mock('../../src/services/background-sync-coordinator');
jest.mock('../../src/services/sync-queue-service');
jest.mock('../../src/services/sync-notification-service');
jest.mock('../../src/services/offline-storage');
jest.mock('../../src/stores/offline-store');

describe('AutomaticSyncService', () => {
  let automaticSyncService: AutomaticSyncService;
  let mockConnectionService: jest.Mocked<ConnectionService>;
  let mockSyncCoordinator: jest.Mocked<BackgroundSyncCoordinator>;
  let mockSyncQueueService: jest.Mocked<SyncQueueService>;
  let mockNotificationService: jest.Mocked<SyncNotificationService>;
  let mockOfflineStorage: jest.Mocked<OfflineStorageService>;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Setup mock implementations
    mockConnectionService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getNetworkStatus: jest.fn().mockReturnValue({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      }),
      addListener: jest.fn().mockReturnValue(() => {}),
      addConnectivityRestoreListener: jest.fn().mockReturnValue(() => {}),
      cleanup: jest.fn(),
    } as any;

    mockSyncCoordinator = {
      initialize: jest.fn().mockResolvedValue(undefined),
      addSyncProgressListener: jest.fn().mockReturnValue(() => {}),
      forceSyncNow: jest.fn().mockResolvedValue({
        total: 5,
        completed: 5,
        failed: 0,
      }),
      setAutoSyncEnabled: jest.fn(),
      getSyncStatus: jest.fn().mockReturnValue({
        isAutoSyncEnabled: true,
        isSyncInProgress: false,
        lastSyncAttempt: null,
        scheduledSync: false,
        connectivityScore: 100,
        networkPriority: 'high',
      }),
      cleanup: jest.fn(),
    } as any;

    mockSyncQueueService = {
      getQueueStats: jest.fn().mockResolvedValue({
        totalPending: 0,
        byType: { create_registration: 0, upload_photo: 0, update_user: 0 },
        highPriority: 0,
        failedOperations: 0,
      }),
      clearFailedOperations: jest.fn().mockResolvedValue(0),
    } as any;

    mockNotificationService = {
      showNotification: jest.fn(),
      notifySyncCompleted: jest.fn(),
      notifyConnectivityRestored: jest.fn(),
      notifyConnectivityLost: jest.fn(),
      notifySyncError: jest.fn(),
      clearNotificationHistory: jest.fn(),
    } as any;

    mockOfflineStorage = {
      initializeDatabase: jest.fn().mockResolvedValue(undefined),
      getDatabaseStats: jest.fn().mockResolvedValue({
        registrationsCount: 10,
        pendingSyncCount: 0,
        queueCount: 0,
        databaseSize: 1024,
      }),
      cleanupOldData: jest.fn().mockResolvedValue(undefined),
      closeDatabase: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Setup singleton mocks
    (ConnectionService.getInstance as jest.Mock).mockReturnValue(mockConnectionService);
    (BackgroundSyncCoordinator.getInstance as jest.Mock).mockReturnValue(mockSyncCoordinator);
    (SyncQueueService.getInstance as jest.Mock).mockReturnValue(mockSyncQueueService);
    (SyncNotificationService.getInstance as jest.Mock).mockReturnValue(mockNotificationService);
    (OfflineStorageService.getInstance as jest.Mock).mockReturnValue(mockOfflineStorage);

    automaticSyncService = AutomaticSyncService.getInstance();
  });

  describe('initialization', () => {
    it('should initialize all services in correct order', async () => {
      await automaticSyncService.initialize();

      expect(mockOfflineStorage.initializeDatabase).toHaveBeenCalledBefore(
        mockConnectionService.initialize as jest.Mock
      );
      expect(mockConnectionService.initialize).toHaveBeenCalledBefore(
        mockSyncCoordinator.initialize as jest.Mock
      );
    });

    it('should set up event listeners during initialization', async () => {
      await automaticSyncService.initialize();

      expect(mockConnectionService.addListener).toHaveBeenCalled();
      expect(mockConnectionService.addConnectivityRestoreListener).toHaveBeenCalled();
      expect(mockSyncCoordinator.addSyncProgressListener).toHaveBeenCalled();
    });

    it('should show initialization success notification', async () => {
      await automaticSyncService.initialize();

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith({
        type: 'success',
        title: '🔄 Sistema de Sincronización',
        message: 'Sistema automático de sincronización activado',
        duration: 3000,
      });
    });

    it('should handle initialization failure gracefully', async () => {
      mockOfflineStorage.initializeDatabase.mockRejectedValue(new Error('Database error'));

      await expect(automaticSyncService.initialize()).rejects.toThrow();

      expect(mockNotificationService.showNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: '❌ Error de Inicialización',
        })
      );
    });

    it('should not initialize twice', async () => {
      await automaticSyncService.initialize();
      await automaticSyncService.initialize(); // Second call

      expect(mockOfflineStorage.initializeDatabase).toHaveBeenCalledTimes(1);
    });
  });

  describe('manual sync', () => {
    beforeEach(async () => {
      await automaticSyncService.initialize();
    });

    it('should force sync successfully', async () => {
      const expectedResult = { total: 3, completed: 3, failed: 0 };
      mockSyncCoordinator.forceSyncNow.mockResolvedValue(expectedResult);

      const result = await automaticSyncService.forceSyncNow();

      expect(result).toEqual(expectedResult);
      expect(mockSyncCoordinator.forceSyncNow).toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      const error = new Error('Sync failed');
      mockSyncCoordinator.forceSyncNow.mockRejectedValue(error);

      await expect(automaticSyncService.forceSyncNow()).rejects.toThrow('Sync failed');
      expect(mockNotificationService.notifySyncError).toHaveBeenCalledWith('Error: Sync failed');
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new (AutomaticSyncService as any)();
      
      await expect(uninitializedService.forceSyncNow())
        .rejects.toThrow('Automatic sync service not initialized');
    });
  });

  describe('auto-sync management', () => {
    beforeEach(async () => {
      await automaticSyncService.initialize();
    });

    it('should enable auto-sync', () => {
      automaticSyncService.setAutoSyncEnabled(true);

      expect(mockSyncCoordinator.setAutoSyncEnabled).toHaveBeenCalledWith(true);
    });

    it('should disable auto-sync', () => {
      automaticSyncService.setAutoSyncEnabled(false);

      expect(mockSyncCoordinator.setAutoSyncEnabled).toHaveBeenCalledWith(false);
    });

    it('should warn if setting auto-sync before initialization', () => {
      const uninitializedService = new (AutomaticSyncService as any)();
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      uninitializedService.setAutoSyncEnabled(true);

      expect(consoleSpy).toHaveBeenCalledWith('⚠️ Cannot set auto-sync before initialization');
      expect(mockSyncCoordinator.setAutoSyncEnabled).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('system health', () => {
    beforeEach(async () => {
      await automaticSyncService.initialize();
    });

    it('should return healthy status with good conditions', async () => {
      const status = await automaticSyncService.getSyncStatus();

      expect(status.systemHealth).toBe('healthy');
      expect(status.isInitialized).toBe(true);
    });

    it('should detect offline warning condition', async () => {
      mockConnectionService.getNetworkStatus.mockReturnValue({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });
      mockSyncQueueService.getQueueStats.mockResolvedValue({
        totalPending: 5,
        byType: { create_registration: 5, upload_photo: 0, update_user: 0 },
        highPriority: 5,
        failedOperations: 0,
      });

      const status = await automaticSyncService.getSyncStatus();

      expect(status.systemHealth).toBe('warning');
    });

    it('should detect error condition with many failures', async () => {
      mockSyncQueueService.getQueueStats.mockResolvedValue({
        totalPending: 10,
        byType: { create_registration: 10, upload_photo: 0, update_user: 0 },
        highPriority: 10,
        failedOperations: 10,
      });

      const status = await automaticSyncService.getSyncStatus();

      expect(status.systemHealth).toBe('error');
    });

    it('should perform comprehensive health check', async () => {
      const healthCheck = await automaticSyncService.performHealthCheck();

      expect(healthCheck).toHaveProperty('overall');
      expect(healthCheck).toHaveProperty('services');
      expect(healthCheck).toHaveProperty('metrics');
      expect(healthCheck.services).toHaveProperty('database');
      expect(healthCheck.services).toHaveProperty('network');
      expect(healthCheck.services).toHaveProperty('sync');
    });

    it('should handle health check database errors', async () => {
      mockOfflineStorage.getDatabaseStats.mockRejectedValue(new Error('DB error'));

      const healthCheck = await automaticSyncService.performHealthCheck();

      expect(healthCheck.services.database).toBe('error');
      expect(healthCheck.overall).toBe('error');
    });
  });

  describe('system maintenance', () => {
    beforeEach(async () => {
      await automaticSyncService.initialize();
    });

    it('should perform maintenance successfully', async () => {
      await automaticSyncService.performMaintenance();

      expect(mockOfflineStorage.cleanupOldData).toHaveBeenCalled();
      expect(mockSyncQueueService.clearFailedOperations).toHaveBeenCalled();
      expect(mockNotificationService.clearNotificationHistory).toHaveBeenCalled();
      expect(mockNotificationService.showNotification).toHaveBeenCalledWith({
        type: 'info',
        title: '🧹 Mantenimiento',
        message: 'Limpieza del sistema completada',
        duration: 3000,
      });
    });

    it('should handle maintenance errors', async () => {
      mockOfflineStorage.cleanupOldData.mockRejectedValue(new Error('Cleanup failed'));

      await expect(automaticSyncService.performMaintenance()).rejects.toThrow();
      expect(mockNotificationService.showNotification).toHaveBeenCalledWith({
        type: 'error',
        title: '❌ Error de Mantenimiento',
        message: 'No se pudo completar la limpieza del sistema',
        duration: 5000,
      });
    });

    it('should throw error if not initialized', async () => {
      const uninitializedService = new (AutomaticSyncService as any)();
      
      await expect(uninitializedService.performMaintenance())
        .rejects.toThrow('Service not initialized');
    });
  });

  describe('event handling', () => {
    beforeEach(async () => {
      await automaticSyncService.initialize();
    });

    it('should handle connectivity restoration', () => {
      const connectivityRestoreCallback = mockConnectionService.addConnectivityRestoreListener.mock.calls[0][0];
      
      connectivityRestoreCallback({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      });

      expect(mockNotificationService.notifyConnectivityRestored).toHaveBeenCalled();
    });

    it('should handle connectivity loss', () => {
      const connectionChangeCallback = mockConnectionService.addListener.mock.calls[0][0];
      
      connectionChangeCallback({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });

      expect(mockNotificationService.notifyConnectivityLost).toHaveBeenCalled();
    });

    it('should handle sync progress completion', () => {
      const syncProgressCallback = mockSyncCoordinator.addSyncProgressListener.mock.calls[0][0];
      
      syncProgressCallback({
        total: 5,
        completed: 5,
        failed: 0,
        // No currentOperation means sync is complete
      });

      expect(mockNotificationService.notifySyncCompleted).toHaveBeenCalledWith({
        total: 5,
        completed: 5,
        failed: 0,
      });
    });

    it('should not notify completion for in-progress sync', () => {
      const syncProgressCallback = mockSyncCoordinator.addSyncProgressListener.mock.calls[0][0];
      
      syncProgressCallback({
        total: 5,
        completed: 2,
        failed: 0,
        currentOperation: 'create_registration:123',
      });

      expect(mockNotificationService.notifySyncCompleted).not.toHaveBeenCalled();
    });
  });

  describe('shutdown', () => {
    it('should cleanup all services', async () => {
      await automaticSyncService.initialize();
      await automaticSyncService.shutdown();

      expect(mockConnectionService.cleanup).toHaveBeenCalled();
      expect(mockSyncCoordinator.cleanup).toHaveBeenCalled();
      expect(mockNotificationService.cleanup).toHaveBeenCalled();
      expect(mockOfflineStorage.closeDatabase).toHaveBeenCalled();
      expect(automaticSyncService.isServiceInitialized()).toBe(false);
    });

    it('should handle cleanup errors gracefully', async () => {
      await automaticSyncService.initialize();
      mockConnectionService.cleanup.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      await automaticSyncService.shutdown();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = AutomaticSyncService.getInstance();
      const instance2 = AutomaticSyncService.getInstance();

      expect(instance1).toBe(instance2);
    });
  });
});