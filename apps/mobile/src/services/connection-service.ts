/**
 * Connection Service
 * Monitors network connectivity and manages online/offline state
 * Enhanced for automatic sync triggering when connectivity is restored
 */

import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';
import { NetworkStatus } from '../types/offline';

type ConnectionListener = (status: NetworkStatus) => void;
type ConnectivityRestoreListener = (status: NetworkStatus) => void;

class ConnectionService {
  private static instance: ConnectionService;
  private currentStatus: NetworkStatus;
  private listeners: ConnectionListener[] = [];
  private connectivityRestoreListeners: ConnectivityRestoreListener[] = [];
  private netInfoUnsubscribe: (() => void) | null = null;
  private wasOffline: boolean = true;
  private connectivityHistoryBuffer: NetworkStatus[] = [];
  private readonly maxHistorySize = 10;

  constructor() {
    this.currentStatus = {
      isConnected: false,
      type: 'unknown',
      isInternetReachable: false,
    };
  }

  public static getInstance(): ConnectionService {
    if (!ConnectionService.instance) {
      ConnectionService.instance = new ConnectionService();
    }
    return ConnectionService.instance;
  }

  /**
   * Initialize network monitoring
   */
  public async initialize(): Promise<void> {
    try {
      // Get initial network state
      const initialState = await NetInfo.fetch();
      this.updateNetworkStatus(initialState);

      // Subscribe to network state changes
      this.netInfoUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
        this.updateNetworkStatus(state);
      });

      console.log('✅ Network monitoring initialized');
    } catch (error) {
      console.error('❌ Failed to initialize network monitoring:', error);
      throw new Error(`Network monitoring initialization failed: ${error}`);
    }
  }

  /**
   * Update network status and notify listeners
   */
  private updateNetworkStatus(state: NetInfoState): void {
    const previousStatus = { ...this.currentStatus };
    const wasOnline = this.isOnline();
    
    this.currentStatus = {
      isConnected: state.isConnected ?? false,
      type: this.mapConnectionType(state.type),
      isInternetReachable: state.isInternetReachable ?? false,
    };

    // Add to connectivity history buffer
    this.connectivityHistoryBuffer.push({ ...this.currentStatus });
    if (this.connectivityHistoryBuffer.length > this.maxHistorySize) {
      this.connectivityHistoryBuffer.shift();
    }

    const isOnline = this.isOnline();

    // Log status changes
    if (previousStatus.isConnected !== this.currentStatus.isConnected) {
      console.log(`🌐 Network status changed: ${this.currentStatus.isConnected ? 'ONLINE' : 'OFFLINE'}`);
    }

    if (previousStatus.isInternetReachable !== this.currentStatus.isInternetReachable) {
      console.log(`🌐 Internet reachability changed: ${this.currentStatus.isInternetReachable ? 'REACHABLE' : 'UNREACHABLE'}`);
    }

    // Detect connectivity restoration
    if (!wasOnline && isOnline) {
      console.log('🔄 Connectivity restored! Triggering automatic sync...');
      this.notifyConnectivityRestored(this.currentStatus);
      this.wasOffline = false;
    } else if (wasOnline && !isOnline) {
      console.log('📴 Connectivity lost - entering offline mode');
      this.wasOffline = true;
    }

    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.currentStatus);
      } catch (error) {
        console.error('❌ Error in network status listener:', error);
      }
    });
  }

  /**
   * Map NetInfo connection type to our simplified type
   */
  private mapConnectionType(type: NetInfoStateType): string {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'ethernet':
        return 'ethernet';
      case 'bluetooth':
        return 'bluetooth';
      case 'none':
        return 'none';
      case 'unknown':
      default:
        return 'unknown';
    }
  }

  /**
   * Get current network status
   */
  public getNetworkStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if device is online
   */
  public isOnline(): boolean {
    return this.currentStatus.isConnected && this.currentStatus.isInternetReachable;
  }

  /**
   * Check if device is connected but internet may not be reachable
   */
  public isConnected(): boolean {
    return this.currentStatus.isConnected;
  }

  /**
   * Check connection quality based on type
   */
  public getConnectionQuality(): 'excellent' | 'good' | 'fair' | 'poor' | 'none' {
    if (!this.currentStatus.isConnected) {
      return 'none';
    }

    switch (this.currentStatus.type) {
      case 'wifi':
      case 'ethernet':
        return this.currentStatus.isInternetReachable ? 'excellent' : 'good';
      case 'cellular':
        return this.currentStatus.isInternetReachable ? 'good' : 'fair';
      case 'bluetooth':
        return 'fair';
      default:
        return 'poor';
    }
  }

  /**
   * Subscribe to network status changes
   */
  public addListener(listener: ConnectionListener): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Remove specific listener
   */
  public removeListener(listener: ConnectionListener): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * Subscribe to connectivity restoration events
   */
  public addConnectivityRestoreListener(listener: ConnectivityRestoreListener): () => void {
    this.connectivityRestoreListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.connectivityRestoreListeners.indexOf(listener);
      if (index > -1) {
        this.connectivityRestoreListeners.splice(index, 1);
      }
    };
  }

  /**
   * Remove specific connectivity restore listener
   */
  public removeConnectivityRestoreListener(listener: ConnectivityRestoreListener): void {
    const index = this.connectivityRestoreListeners.indexOf(listener);
    if (index > -1) {
      this.connectivityRestoreListeners.splice(index, 1);
    }
  }

  /**
   * Notify connectivity restore listeners
   */
  private notifyConnectivityRestored(status: NetworkStatus): void {
    this.connectivityRestoreListeners.forEach(listener => {
      try {
        listener(status);
      } catch (error) {
        console.error('❌ Error in connectivity restore listener:', error);
      }
    });
  }

  /**
   * Get connectivity quality score for sync prioritization
   */
  public getConnectivityScore(): number {
    if (!this.isOnline()) return 0;
    
    switch (this.currentStatus.type) {
      case 'wifi':
      case 'ethernet':
        return this.currentStatus.isInternetReachable ? 100 : 80;
      case 'cellular':
        return this.currentStatus.isInternetReachable ? 70 : 50;
      case 'bluetooth':
        return 30;
      default:
        return 10;
    }
  }

  /**
   * Check if current connection is suitable for sync
   */
  public isSuitableForSync(requireHighQuality: boolean = false): boolean {
    const score = this.getConnectivityScore();
    return requireHighQuality ? score >= 70 : score >= 50;
  }

  /**
   * Get network type priority for sync operations
   */
  public getNetworkTypePriority(): 'high' | 'medium' | 'low' | 'none' {
    if (!this.isOnline()) return 'none';
    
    switch (this.currentStatus.type) {
      case 'wifi':
      case 'ethernet':
        return 'high';
      case 'cellular':
        return 'medium';
      default:
        return 'low';
    }
  }

  /**
   * Get connectivity stability based on recent history
   */
  public getConnectivityStability(): 'stable' | 'unstable' | 'unknown' {
    if (this.connectivityHistoryBuffer.length < 3) return 'unknown';
    
    const recentHistory = this.connectivityHistoryBuffer.slice(-5);
    const connectionChanges = recentHistory.reduce((changes, status, index) => {
      if (index === 0) return 0;
      const prev = recentHistory[index - 1];
      return changes + (status.isConnected !== prev.isConnected ? 1 : 0);
    }, 0);
    
    return connectionChanges <= 1 ? 'stable' : 'unstable';
  }

  /**
   * Wait for stable connection before sync
   */
  public async waitForStableConnection(timeout: number = 30000): Promise<boolean> {
    if (this.isOnline() && this.getConnectivityStability() === 'stable') {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);

      let stabilityCheckCount = 0;
      const requiredStableChecks = 3;

      const unsubscribe = this.addListener((status) => {
        if (status.isConnected && status.isInternetReachable) {
          stabilityCheckCount++;
          
          // Check stability after a few consecutive successful checks
          if (stabilityCheckCount >= requiredStableChecks) {
            const stability = this.getConnectivityStability();
            if (stability === 'stable' || stability === 'unknown') {
              clearTimeout(timeoutId);
              unsubscribe();
              resolve(true);
            }
          }
        } else {
          stabilityCheckCount = 0; // Reset on connectivity loss
        }
      });
    });
  }

  /**
   * Test internet connectivity by making a request
   */
  public async testInternetConnectivity(timeout: number = 5000): Promise<boolean> {
    if (!this.currentStatus.isConnected) {
      return false;
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const response = await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.status === 204;
    } catch (error) {
      console.log('❌ Internet connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Wait for network connection
   */
  public async waitForConnection(timeout: number = 30000): Promise<boolean> {
    if (this.isOnline()) {
      return true;
    }

    return new Promise((resolve) => {
      const timeoutId = setTimeout(() => {
        unsubscribe();
        resolve(false);
      }, timeout);

      const unsubscribe = this.addListener((status) => {
        if (status.isConnected && status.isInternetReachable) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve(true);
        }
      });
    });
  }

  /**
   * Get connection statistics
   */
  public getConnectionStats(): {
    currentType: string;
    isOnline: boolean;
    quality: string;
    listeners: number;
  } {
    return {
      currentType: this.currentStatus.type,
      isOnline: this.isOnline(),
      quality: this.getConnectionQuality(),
      listeners: this.listeners.length,
    };
  }

  /**
   * Refresh network status
   */
  public async refresh(): Promise<NetworkStatus> {
    try {
      const state = await NetInfo.fetch();
      this.updateNetworkStatus(state);
      return this.getNetworkStatus();
    } catch (error) {
      console.error('❌ Failed to refresh network status:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    if (this.netInfoUnsubscribe) {
      this.netInfoUnsubscribe();
      this.netInfoUnsubscribe = null;
    }
    
    this.listeners = [];
    this.connectivityRestoreListeners = [];
    this.connectivityHistoryBuffer = [];
    console.log('✅ Network monitoring cleanup completed');
  }

  /**
   * Get human-readable status description
   */
  public getStatusDescription(): string {
    if (!this.currentStatus.isConnected) {
      return 'No network connection';
    }

    if (!this.currentStatus.isInternetReachable) {
      return `Connected to ${this.currentStatus.type} but no internet access`;
    }

    const quality = this.getConnectionQuality();
    return `Connected via ${this.currentStatus.type} (${quality} connection)`;
  }
}

export default ConnectionService;