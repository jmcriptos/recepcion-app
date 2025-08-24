/**
 * Background Sync Coordinator
 * Manages automatic synchronization when network connectivity is restored
 * Prevents multiple sync processes and handles sync scheduling
 */

import ConnectionService from './connection-service';
import SyncQueueService from './sync-queue-service';
import { NetworkStatus, SyncProgress } from '../types/offline';

interface SyncScheduleOptions {
  delayMs?: number;
  requireStableConnection?: boolean;
  minConnectivityScore?: number;
  respectBatteryOptimization?: boolean;
  maxConcurrentSyncs?: number;
}

class BackgroundSyncCoordinator {
  private static instance: BackgroundSyncCoordinator;
  private connectionService: ConnectionService;
  private syncQueueService: SyncQueueService;
  private isAutoSyncEnabled: boolean = true;
  private isSyncInProgress: boolean = false;
  private connectivityRestoreUnsubscribe: (() => void) | null = null;
  private scheduledSyncTimeoutId: NodeJS.Timeout | null = null;
  private syncProgressCallbacks: Array<(progress: SyncProgress) => void> = [];
  private lastSyncAttempt: Date | null = null;
  private readonly minSyncInterval = 30000; // 30 seconds minimum between syncs

  constructor() {
    this.connectionService = ConnectionService.getInstance();
    this.syncQueueService = SyncQueueService.getInstance();
  }

  public static getInstance(): BackgroundSyncCoordinator {
    if (!BackgroundSyncCoordinator.instance) {
      BackgroundSyncCoordinator.instance = new BackgroundSyncCoordinator();
    }
    return BackgroundSyncCoordinator.instance;
  }

  /**
   * Initialize background sync coordination
   */
  public async initialize(): Promise<void> {
    try {
      // Subscribe to connectivity restoration events
      this.connectivityRestoreUnsubscribe = this.connectionService.addConnectivityRestoreListener(
        this.handleConnectivityRestored.bind(this)
      );

      console.log('✅ Background sync coordinator initialized');
    } catch (error) {
      console.error('❌ Failed to initialize background sync coordinator:', error);
      throw new Error(`Background sync coordinator initialization failed: ${error}`);
    }
  }

  /**
   * Handle connectivity restoration
   */
  private async handleConnectivityRestored(networkStatus: NetworkStatus): Promise<void> {
    if (!this.isAutoSyncEnabled) {
      console.log('📴 Auto-sync is disabled, skipping automatic sync');
      return;
    }

    if (this.isSyncInProgress) {
      console.log('🔄 Sync already in progress, skipping duplicate sync trigger');
      return;
    }

    // Check minimum interval between sync attempts
    if (this.lastSyncAttempt) {
      const timeSinceLastSync = Date.now() - this.lastSyncAttempt.getTime();
      if (timeSinceLastSync < this.minSyncInterval) {
        console.log('⏱️ Too soon since last sync attempt, waiting...');
        return;
      }
    }

    console.log('🔄 Connectivity restored, scheduling automatic sync...');
    await this.scheduleSync({
      delayMs: 2000, // 2 second delay to ensure stable connection
      requireStableConnection: true,
      minConnectivityScore: 50,
      respectBatteryOptimization: true,
    });
  }

  /**
   * Schedule a sync operation with configurable options
   */
  public async scheduleSync(options: SyncScheduleOptions = {}): Promise<void> {
    const {
      delayMs = 0,
      requireStableConnection = false,
      minConnectivityScore = 0,
      respectBatteryOptimization = true,
    } = options;

    // Clear any existing scheduled sync
    if (this.scheduledSyncTimeoutId) {
      clearTimeout(this.scheduledSyncTimeoutId);
      this.scheduledSyncTimeoutId = null;
    }

    this.scheduledSyncTimeoutId = setTimeout(async () => {
      try {
        await this.executeScheduledSync({
          requireStableConnection,
          minConnectivityScore,
          respectBatteryOptimization,
        });
      } catch (error) {
        console.error('❌ Scheduled sync failed:', error);
      } finally {
        this.scheduledSyncTimeoutId = null;
      }
    }, delayMs);

    console.log(`⏰ Sync scheduled to run in ${delayMs}ms`);
  }

  /**
   * Execute a scheduled sync operation
   */
  private async executeScheduledSync(options: {
    requireStableConnection: boolean;
    minConnectivityScore: number;
    respectBatteryOptimization: boolean;
  }): Promise<void> {
    try {
      // Check if we should proceed with sync based on current conditions
      const canProceed = await this.canProceedWithSync(options);
      if (!canProceed) {
        console.log('❌ Sync conditions not met, postponing sync');
        return;
      }

      // Record sync attempt
      this.lastSyncAttempt = new Date();

      // Execute the sync
      console.log('🔄 Starting automatic background sync...');
      await this.executeSync();

    } catch (error) {
      console.error('❌ Background sync failed:', error);
      throw error;
    }
  }

  /**
   * Check if sync can proceed based on current conditions
   */
  private async canProceedWithSync(options: {
    requireStableConnection: boolean;
    minConnectivityScore: number;
    respectBatteryOptimization: boolean;
  }): Promise<boolean> {
    // Check if auto-sync is enabled
    if (!this.isAutoSyncEnabled) {
      console.log('📴 Auto-sync is disabled');
      return false;
    }

    // Check if sync is already in progress
    if (this.isSyncInProgress) {
      console.log('🔄 Sync already in progress');
      return false;
    }

    // Check network connectivity
    if (!this.connectionService.isOnline()) {
      console.log('🌐 No network connection available');
      return false;
    }

    // Check minimum connectivity score
    const connectivityScore = this.connectionService.getConnectivityScore();
    if (connectivityScore < options.minConnectivityScore) {
      console.log(`📶 Connectivity score (${connectivityScore}) below minimum (${options.minConnectivityScore})`);
      return false;
    }

    // Check connection stability if required
    if (options.requireStableConnection) {
      const stability = this.connectionService.getConnectivityStability();
      if (stability === 'unstable') {
        console.log('📶 Connection is unstable, waiting for stability');
        
        // Wait for stable connection with timeout
        const isStable = await this.connectionService.waitForStableConnection(10000);
        if (!isStable) {
          console.log('⏰ Timeout waiting for stable connection');
          return false;
        }
      }
    }

    // Check if there are pending operations to sync
    const queueStats = await this.syncQueueService.getQueueStats();
    if (queueStats.totalPending === 0) {
      console.log('✅ No pending operations to sync');
      return false;
    }

    console.log(`✅ Sync conditions met: ${queueStats.totalPending} pending operations`);
    return true;
  }

  /**
   * Execute sync and handle progress
   */
  private async executeSync(): Promise<void> {
    if (this.isSyncInProgress) {
      throw new Error('Sync already in progress');
    }

    this.isSyncInProgress = true;

    try {
      // Execute sync with progress tracking
      const syncProgress = await this.syncQueueService.processQueue((progress) => {
        // Notify progress callbacks
        this.syncProgressCallbacks.forEach(callback => {
          try {
            callback(progress);
          } catch (error) {
            console.error('❌ Error in sync progress callback:', error);
          }
        });
      });

      console.log(`✅ Background sync completed: ${syncProgress.completed} successful, ${syncProgress.failed} failed`);

      // Final progress notification
      this.syncProgressCallbacks.forEach(callback => {
        try {
          callback(syncProgress);
        } catch (error) {
          console.error('❌ Error in final sync progress callback:', error);
        }
      });

    } catch (error) {
      console.error('❌ Background sync execution failed:', error);
      throw error;
    } finally {
      this.isSyncInProgress = false;
    }
  }

  /**
   * Force sync to run immediately (manual trigger)
   */
  public async forceSyncNow(): Promise<SyncProgress> {
    if (this.isSyncInProgress) {
      throw new Error('Sync already in progress');
    }

    if (!this.connectionService.isOnline()) {
      throw new Error('No network connection available for sync');
    }

    console.log('🔄 Forcing immediate sync...');
    this.lastSyncAttempt = new Date();

    try {
      await this.executeSync();
      
      // Get final stats
      const queueStats = await this.syncQueueService.getQueueStats();
      return {
        total: 0, // Will be updated by actual sync
        completed: 0, // Will be updated by actual sync
        failed: queueStats.failedOperations,
      };
    } catch (error) {
      console.error('❌ Force sync failed:', error);
      throw error;
    }
  }

  /**
   * Enable or disable automatic sync
   */
  public setAutoSyncEnabled(enabled: boolean): void {
    const wasEnabled = this.isAutoSyncEnabled;
    this.isAutoSyncEnabled = enabled;

    if (wasEnabled !== enabled) {
      console.log(`⚙️ Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
      
      // Cancel any scheduled sync if disabling
      if (!enabled && this.scheduledSyncTimeoutId) {
        clearTimeout(this.scheduledSyncTimeoutId);
        this.scheduledSyncTimeoutId = null;
        console.log('⏰ Cancelled scheduled sync');
      }
    }
  }

  /**
   * Check if auto-sync is enabled
   */
  public isAutoSyncEnabledStatus(): boolean {
    return this.isAutoSyncEnabled;
  }

  /**
   * Check if sync is currently in progress
   */
  public isSyncInProgressStatus(): boolean {
    return this.isSyncInProgress;
  }

  /**
   * Add sync progress callback
   */
  public addSyncProgressListener(callback: (progress: SyncProgress) => void): () => void {
    this.syncProgressCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.syncProgressCallbacks.indexOf(callback);
      if (index > -1) {
        this.syncProgressCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get sync coordinator status
   */
  public getSyncStatus(): {
    isAutoSyncEnabled: boolean;
    isSyncInProgress: boolean;
    lastSyncAttempt: Date | null;
    scheduledSync: boolean;
    connectivityScore: number;
    networkPriority: string;
  } {
    return {
      isAutoSyncEnabled: this.isAutoSyncEnabled,
      isSyncInProgress: this.isSyncInProgress,
      lastSyncAttempt: this.lastSyncAttempt,
      scheduledSync: this.scheduledSyncTimeoutId !== null,
      connectivityScore: this.connectionService.getConnectivityScore(),
      networkPriority: this.connectionService.getNetworkTypePriority(),
    };
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.connectivityRestoreUnsubscribe) {
      this.connectivityRestoreUnsubscribe();
      this.connectivityRestoreUnsubscribe = null;
    }

    if (this.scheduledSyncTimeoutId) {
      clearTimeout(this.scheduledSyncTimeoutId);
      this.scheduledSyncTimeoutId = null;
    }

    this.syncProgressCallbacks = [];
    console.log('✅ Background sync coordinator cleanup completed');
  }
}

export default BackgroundSyncCoordinator;