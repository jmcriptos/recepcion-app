/**
 * Offline Store
 * Zustand store for offline functionality state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NetworkStatus, SyncProgress, DatabaseStats } from '../types/offline';

interface OfflineState {
  // Network status
  networkStatus: NetworkStatus;
  isInitialized: boolean;
  
  // Sync status
  syncProgress: SyncProgress | null;
  isAutoSyncEnabled: boolean;
  lastSyncTime: string | null;
  
  // Database stats
  dbStats: DatabaseStats | null;
  
  // UI state
  showOfflineIndicator: boolean;
  offlineMode: boolean;
  
  // Actions
  setNetworkStatus: (status: NetworkStatus) => void;
  setInitialized: (initialized: boolean) => void;
  setSyncProgress: (progress: SyncProgress | null) => void;
  setAutoSyncEnabled: (enabled: boolean) => void;
  setLastSyncTime: (time: string) => void;
  setDbStats: (stats: DatabaseStats) => void;
  setShowOfflineIndicator: (show: boolean) => void;
  setOfflineMode: (enabled: boolean) => void;
  reset: () => void;
}

const initialState = {
  networkStatus: {
    isConnected: false,
    type: 'unknown',
    isInternetReachable: false,
  },
  isInitialized: false,
  syncProgress: null,
  isAutoSyncEnabled: true,
  lastSyncTime: null,
  dbStats: null,
  showOfflineIndicator: true,
  offlineMode: false,
};

export const useOfflineStore = create<OfflineState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setNetworkStatus: (status: NetworkStatus) => {
        const currentStatus = get().networkStatus;
        const wasOnline = currentStatus.isConnected && currentStatus.isInternetReachable;
        const isOnline = status.isConnected && status.isInternetReachable;
        
        // Update offline mode based on connection
        const shouldShowOffline = !isOnline;
        
        set({
          networkStatus: status,
          showOfflineIndicator: shouldShowOffline && get().showOfflineIndicator,
        });

        // Log significant status changes
        if (wasOnline !== isOnline) {
          console.log(`📱 App mode: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);
        }
      },

      setInitialized: (initialized: boolean) => {
        set({ isInitialized: initialized });
      },

      setSyncProgress: (progress: SyncProgress | null) => {
        set({ syncProgress: progress });
        
        // Update last sync time when sync completes
        if (progress && progress.completed > 0 && !progress.currentOperation) {
          set({ lastSyncTime: new Date().toISOString() });
        }
      },

      setAutoSyncEnabled: (enabled: boolean) => {
        set({ isAutoSyncEnabled: enabled });
        console.log(`⚙️ Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
      },

      setLastSyncTime: (time: string) => {
        set({ lastSyncTime: time });
      },

      setDbStats: (stats: DatabaseStats) => {
        set({ dbStats: stats });
      },

      setShowOfflineIndicator: (show: boolean) => {
        set({ showOfflineIndicator: show });
      },

      setOfflineMode: (enabled: boolean) => {
        set({ offlineMode: enabled });
        console.log(`📱 Force offline mode: ${enabled ? 'ON' : 'OFF'}`);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'offline-store',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
      // Only persist certain fields
      // @ts-ignore - zustand persist partialize has typing issues
      partialize: (state) => ({
        isAutoSyncEnabled: state.isAutoSyncEnabled,
        lastSyncTime: state.lastSyncTime,
        showOfflineIndicator: state.showOfflineIndicator,
        offlineMode: state.offlineMode,
      }),
    }
  )
);

// Selectors for convenience
export const useNetworkStatus = () => useOfflineStore(state => state.networkStatus);
export const useIsOnline = () => useOfflineStore(state => 
  state.networkStatus.isConnected && state.networkStatus.isInternetReachable && !state.offlineMode
);
export const useIsOffline = () => useOfflineStore(state => 
  !state.networkStatus.isConnected || !state.networkStatus.isInternetReachable || state.offlineMode
);
export const useSyncProgress = () => useOfflineStore(state => state.syncProgress);
export const useDbStats = () => useOfflineStore(state => state.dbStats);
export const useAutoSyncEnabled = () => useOfflineStore(state => state.isAutoSyncEnabled);
export const useLastSyncTime = () => useOfflineStore(state => state.lastSyncTime);
export const useShowOfflineIndicator = () => useOfflineStore(state => state.showOfflineIndicator);
export const useOfflineMode = () => useOfflineStore(state => state.offlineMode);