/**
 * Automatic Sync Service
 * Main integration service that coordinates all sync-related services
 * Implements the complete automatic synchronization workflow
 */

import ConnectionService from './connection-service';
import BackgroundSyncCoordinator from './background-sync-coordinator';
import SyncQueueService from './sync-queue-service';
import SyncNotificationService from './sync-notification-service';
import OfflineStorageService from './offline-storage';
import { useOfflineStore } from '../stores/offline-store';
import { NetworkStatus, SyncProgress } from '../types/offline';

class AutomaticSyncService {
  private static instance: AutomaticSyncService;
  private connectionService: ConnectionService;
  private syncCoordinator: BackgroundSyncCoordinator;
  private syncQueueService: SyncQueueService;
  private notificationService: SyncNotificationService;
  private offlineStorage: OfflineStorageService;
  private isInitialized: boolean = false;

  // Event listeners cleanup functions
  private cleanupFunctions: Array<() => void> = [];

  constructor() {
    this.connectionService = ConnectionService.getInstance();
    this.syncCoordinator = BackgroundSyncCoordinator.getInstance();
    this.syncQueueService = SyncQueueService.getInstance();
    this.notificationService = SyncNotificationService.getInstance();
    this.offlineStorage = OfflineStorageService.getInstance();
  }

  public static getInstance(): AutomaticSyncService {
    if (!AutomaticSyncService.instance) {
      AutomaticSyncService.instance = new AutomaticSyncService();
    }
    return AutomaticSyncService.instance;
  }

  /**
   * Initialize the complete automatic sync system
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('⚠️ Automatic sync service already initialized');
      return;
    }

    try {
      console.log('🚀 Initializing automatic sync system...');

      // Initialize offline storage first
      await this.offlineStorage.initializeDatabase();
      console.log('✅ Offline storage initialized');

      // Initialize connection monitoring
      await this.connectionService.initialize();
      console.log('✅ Connection service initialized');

      // Initialize background sync coordinator
      await this.syncCoordinator.initialize();
      console.log('✅ Background sync coordinator initialized');

      // Set up event listeners
      this.setupEventListeners();
      console.log('✅ Event listeners configured');

      // Set up store integration
      this.setupStoreIntegration();
      console.log('✅ Store integration configured');

      this.isInitialized = true;
      console.log('🎉 Automatic sync system initialized successfully');

      // Show initialization notification
      this.notificationService.showNotification({
        type: 'success',
        title: '🔄 Sistema de Sincronización',
        message: 'Sistema automático de sincronización activado',
        duration: 3000,
      });

    } catch (error) {
      console.error('❌ Failed to initialize automatic sync service:', error);
      
      this.notificationService.showNotification({
        type: 'error',
        title: '❌ Error de Inicialización',
        message: 'No se pudo inicializar el sistema de sincronización',
        duration: 8000,
      });

      throw new Error(`Automatic sync service initialization failed: ${error}`);
    }
  }

  /**
   * Set up event listeners for automatic sync
   */
  private setupEventListeners(): void {
    // Connection status change listener
    const connectionUnsubscribe = this.connectionService.addListener((status: NetworkStatus) => {
      this.handleConnectionChange(status);
    });
    this.cleanupFunctions.push(connectionUnsubscribe);

    // Connectivity restoration listener
    const restoreUnsubscribe = this.connectionService.addConnectivityRestoreListener((status: NetworkStatus) => {
      this.handleConnectivityRestored(status);
    });
    this.cleanupFunctions.push(restoreUnsubscribe);

    // Sync progress listener
    const progressUnsubscribe = this.syncCoordinator.addSyncProgressListener((progress: SyncProgress) => {
      this.handleSyncProgress(progress);
    });
    this.cleanupFunctions.push(progressUnsubscribe);
  }

  /**
   * Set up integration with Zustand stores
   */
  private setupStoreIntegration(): void {
    const { setNetworkStatus, setSyncProgress } = useOfflineStore.getState();

    // Initialize store with current network status
    setNetworkStatus(this.connectionService.getNetworkStatus());

    // Update store when network status changes
    const networkStatusUnsubscribe = this.connectionService.addListener((status: NetworkStatus) => {
      setNetworkStatus(status);
    });
    this.cleanupFunctions.push(networkStatusUnsubscribe);

    // Update store when sync progress changes
    const syncProgressUnsubscribe = this.syncCoordinator.addSyncProgressListener((progress: SyncProgress) => {
      setSyncProgress(progress);
    });
    this.cleanupFunctions.push(syncProgressUnsubscribe);
  }

  /**
   * Handle connection status changes
   */
  private handleConnectionChange(status: NetworkStatus): void {
    const isOnline = status.isConnected && status.isInternetReachable;
    
    if (!isOnline) {
      this.notificationService.notifyConnectivityLost();
    }
    
    console.log(`🌐 Connection status: ${isOnline ? 'ONLINE' : 'OFFLINE'} (${status.type})`);
  }

  /**
   * Handle connectivity restoration
   */
  private handleConnectivityRestored(status: NetworkStatus): void {
    this.notificationService.notifyConnectivityRestored();
    
    // The BackgroundSyncCoordinator will handle the actual sync scheduling
    console.log('🔄 Connectivity restored, automatic sync will be triggered');
  }

  /**
   * Handle sync progress updates
   */
  private handleSyncProgress(progress: SyncProgress): void {
    console.log(`📊 Sync progress: ${progress.completed}/${progress.total} completed, ${progress.failed} failed`);
    
    // Final progress notification when sync completes
    if (!progress.currentOperation && progress.total > 0) {
      this.notificationService.notifySyncCompleted(progress);
    }
  }

  /**
   * Force manual sync (for UI triggers)
   */
  public async forceSyncNow(): Promise<SyncProgress> {
    if (!this.isInitialized) {
      throw new Error('Automatic sync service not initialized');
    }

    console.log('🔄 Manual sync requested');
    
    try {
      const result = await this.syncCoordinator.forceSyncNow();
      console.log('✅ Manual sync completed');
      return result;
    } catch (error) {
      console.error('❌ Manual sync failed:', error);
      this.notificationService.notifySyncError(String(error));
      throw error;
    }
  }

  /**
   * Get comprehensive sync dashboard data
   */
  public async getSyncDashboardData(): Promise<{
    systemHealth: 'healthy' | 'warning' | 'error';
    networkStatus: any;
    queueStats: any;
    syncErrors: any[];
    lastSyncTime?: string;
    isAutoSyncEnabled: boolean;
  }> {
    if (!this.isInitialized) {
      throw new Error('Automatic sync service not initialized');
    }

    try {
      const [queueStats, syncErrors] = await Promise.all([
        this.syncQueueService.getQueueStats(),
        this.syncQueueService.getSyncErrors(),
      ]);

      const networkStatus = this.connectionService.getNetworkStatus();
      
      // Determine system health
      let systemHealth: 'healthy' | 'warning' | 'error' = 'healthy';
      if (!networkStatus.isConnected && queueStats.totalPending > 0) {
        systemHealth = 'warning';
      } else if (queueStats.failedOperations > 5) {
        systemHealth = 'error';
      }

      // Get store state for additional info
      const { lastSyncTime, isAutoSyncEnabled } = useOfflineStore.getState();

      return {
        systemHealth,
        networkStatus,
        queueStats,
        syncErrors,
        lastSyncTime: lastSyncTime || undefined,
        isAutoSyncEnabled,
      };
    } catch (error) {
      console.error('❌ Failed to get sync dashboard data:', error);
      throw error;
    }
  }

  /**
   * Retry a specific failed sync operation
   */
  public async retryFailedOperation(errorId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Automatic sync service not initialized');
    }

    try {
      await this.syncQueueService.retryFailedOperation(errorId);
      console.log(`✅ Successfully retried operation: ${errorId}`);
    } catch (error) {
      console.error(`❌ Failed to retry operation ${errorId}:`, error);
      throw error;
    }
  }

  /**
   * Clear a specific sync error
   */
  public async clearSyncError(errorId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Automatic sync service not initialized');
    }

    try {
      await this.syncQueueService.clearError(errorId);
      console.log(`✅ Successfully cleared error: ${errorId}`);
    } catch (error) {
      console.error(`❌ Failed to clear error ${errorId}:`, error);
      throw error;
    }
  }

  /**
   * Enable or disable automatic sync
   */
  public setAutoSyncEnabled(enabled: boolean): void {
    if (!this.isInitialized) {
      console.warn('⚠️ Cannot set auto-sync before initialization');
      return;
    }

    this.syncCoordinator.setAutoSyncEnabled(enabled);
    
    const { setAutoSyncEnabled } = useOfflineStore.getState();
    setAutoSyncEnabled(enabled);
    
    console.log(`⚙️ Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Get comprehensive sync status
   */
  public async getSyncStatus(): Promise<{
    isInitialized: boolean;
    networkStatus: NetworkStatus;
    syncCoordinatorStatus: any;
    queueStats: any;
    systemHealth: 'healthy' | 'warning' | 'error';
  }> {
    const networkStatus = this.connectionService.getNetworkStatus();
    const syncCoordinatorStatus = this.syncCoordinator.getSyncStatus();
    
    let queueStats = null;
    let systemHealth: 'healthy' | 'warning' | 'error' = 'healthy';
    
    try {
      queueStats = await this.syncQueueService.getQueueStats();
      
      // Determine system health
      if (!networkStatus.isConnected && queueStats.totalPending > 0) {
        systemHealth = 'warning'; // Offline with pending items
      } else if (queueStats.failedOperations > 5) {
        systemHealth = 'error'; // Too many failed operations
      }
      
    } catch (error) {
      console.error('❌ Failed to get queue stats:', error);
      systemHealth = 'error';
    }

    return {
      isInitialized: this.isInitialized,
      networkStatus,
      syncCoordinatorStatus,
      queueStats,
      systemHealth,
    };
  }

  /**
   * Perform system health check
   */
  public async performHealthCheck(): Promise<{
    overall: 'healthy' | 'warning' | 'error';
    services: {
      database: 'ok' | 'error';
      network: 'ok' | 'warning' | 'error';
      sync: 'ok' | 'warning' | 'error';
    };
    metrics: {
      pendingOperations: number;
      failedOperations: number;
      uptime: number;
    };
  }> {
    const services: {
      database: 'ok' | 'error';
      network: 'ok' | 'warning' | 'error';
      sync: 'ok' | 'warning' | 'error';
    } = {
      database: 'ok',
      network: 'ok',
      sync: 'ok',
    };

    // Test database
    try {
      await this.offlineStorage.getDatabaseStats();
    } catch (error) {
      services.database = 'error';
      console.error('❌ Database health check failed:', error);
    }

    // Test network
    const networkStatus = this.connectionService.getNetworkStatus();
    if (!networkStatus.isConnected) {
      services.network = 'error';
    } else if (!networkStatus.isInternetReachable) {
      services.network = 'warning';
    }

    // Test sync system
    try {
      const queueStats = await this.syncQueueService.getQueueStats();
      if (queueStats.failedOperations > 10) {
        services.sync = 'error';
      } else if (queueStats.failedOperations > 0) {
        services.sync = 'warning';
      }

      const overall = Object.values(services).includes('error') ? 'error' :
                     Object.values(services).includes('warning') ? 'warning' : 'healthy';

      return {
        overall,
        services,
        metrics: {
          pendingOperations: queueStats.totalPending,
          failedOperations: queueStats.failedOperations,
          uptime: this.isInitialized ? Date.now() : 0,
        },
      };
    } catch (error) {
      console.error('❌ Sync health check failed:', error);
      return {
        overall: 'error',
        services: { ...services, sync: 'error' },
        metrics: {
          pendingOperations: 0,
          failedOperations: 0,
          uptime: 0,
        },
      };
    }
  }

  /**
   * Clean up old data and optimize system
   */
  public async performMaintenance(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Service not initialized');
    }

    console.log('🧹 Performing system maintenance...');

    try {
      // Clean up old data
      await this.offlineStorage.cleanupOldData();
      
      // Clear old failed operations
      await this.syncQueueService.clearFailedOperations();
      
      // Clear old notification history
      this.notificationService.clearNotificationHistory();
      
      console.log('✅ System maintenance completed');
      
      this.notificationService.showNotification({
        type: 'info',
        title: '🧹 Mantenimiento',
        message: 'Limpieza del sistema completada',
        duration: 3000,
      });
      
    } catch (error) {
      console.error('❌ Maintenance failed:', error);
      
      this.notificationService.showNotification({
        type: 'error',
        title: '❌ Error de Mantenimiento',
        message: 'No se pudo completar la limpieza del sistema',
        duration: 5000,
      });
      
      throw error;
    }
  }

  /**
   * Cleanup and shutdown the service
   */
  public async shutdown(): Promise<void> {
    console.log('🔄 Shutting down automatic sync service...');

    // Clean up all event listeners
    this.cleanupFunctions.forEach(cleanup => {
      try {
        cleanup();
      } catch (error) {
        console.error('❌ Error during cleanup:', error);
      }
    });
    this.cleanupFunctions = [];

    // Cleanup individual services
    this.connectionService.cleanup();
    this.syncCoordinator.cleanup();
    this.notificationService.cleanup();

    // Close database connection
    await this.offlineStorage.closeDatabase();

    this.isInitialized = false;
    console.log('✅ Automatic sync service shutdown completed');
  }

  /**
   * Check if service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

export default AutomaticSyncService;