/**
 * Connection Status Components
 * Visual indicators for network and sync status
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Box, Badge, HStack, VStack, Progress } from 'native-base';
// Temporary text icons to resolve build - replace with proper icons later
import {
  useNetworkStatus,
  useIsOnline,
  useIsOffline,
  useSyncProgress,
  useShowOfflineIndicator,
  useLastSyncTime,
  useOfflineStore,
} from '../stores/offline-store';

/**
 * Main connection status indicator
 */
export const ConnectionStatusIndicator: React.FC = () => {
  const networkStatus = useNetworkStatus();
  const isOnline = useIsOnline();
  const showIndicator = useShowOfflineIndicator();
  
  if (!showIndicator) {
    return null;
  }

  // Removed unused functions - using inline icons now

  const getStatusText = () => {
    if (isOnline) return 'Online';
    if (networkStatus.isConnected) return 'No Internet';
    return 'Offline';
  };

  return (
    <Badge
      colorScheme={isOnline ? 'success' : networkStatus.isConnected ? 'warning' : 'error'}
      variant="solid"
      _text={{ fontSize: 'xs', fontWeight: 'medium' }}
      leftIcon={<Text style={{fontSize: 12}}>📶</Text>}
    >
      {getStatusText()}
    </Badge>
  );
};

/**
 * Detailed connection status card
 */
export const ConnectionStatusCard: React.FC<{
  onToggleOfflineMode?: () => void;
  onRefresh?: () => void;
}> = ({ onToggleOfflineMode, onRefresh }) => {
  const networkStatus = useNetworkStatus();
  const isOnline = useIsOnline();
  // const isOffline = useIsOffline(); // Unused, removed
  const lastSyncTime = useLastSyncTime();
  const { offlineMode, setOfflineMode } = useOfflineStore();

  const getConnectionQuality = () => {
    if (!networkStatus.isConnected) return 'none';
    
    switch (networkStatus.type) {
      case 'wifi':
      case 'ethernet':
        return networkStatus.isInternetReachable ? 'excellent' : 'good';
      case 'cellular':
        return networkStatus.isInternetReachable ? 'good' : 'fair';
      default:
        return 'poor';
    }
  };

  const formatLastSync = () => {
    if (!lastSyncTime) return 'Never';
    
    const now = new Date();
    const syncTime = new Date(lastSyncTime);
    const diffMs = now.getTime() - syncTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} hours ago`;
    return syncTime.toLocaleDateString();
  };

  const handleToggleOfflineMode = () => {
    setOfflineMode(!offlineMode);
    onToggleOfflineMode?.();
  };

  return (
    <Box bg="white" p="4" rounded="lg" shadow="1" mb="4">
      <VStack space="3">
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space="2" alignItems="center">
            <Text style={{fontSize: 20}}>{isOnline ? '📶' : networkStatus.isConnected ? '📶' : '📵'}</Text>
            <Text style={styles.title}>Connection Status</Text>
          </HStack>
          
          {onRefresh && (
            <TouchableOpacity onPress={onRefresh}>
              <Text style={{fontSize: 20}}>🔄</Text>
            </TouchableOpacity>
          )}
        </HStack>

        {/* Status Details */}
        <VStack space="2">
          <HStack justifyContent="space-between">
            <Text style={styles.label}>Network Type:</Text>
            <Text style={styles.value}>{networkStatus.type || 'Unknown'}</Text>
          </HStack>
          
          <HStack justifyContent="space-between">
            <Text style={styles.label}>Connection:</Text>
            <Badge
              colorScheme={networkStatus.isConnected ? 'success' : 'error'}
              variant="subtle"
            >
              {networkStatus.isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </HStack>
          
          <HStack justifyContent="space-between">
            <Text style={styles.label}>Internet:</Text>
            <Badge
              colorScheme={networkStatus.isInternetReachable ? 'success' : 'warning'}
              variant="subtle"
            >
              {networkStatus.isInternetReachable ? 'Reachable' : 'Unreachable'}
            </Badge>
          </HStack>
          
          <HStack justifyContent="space-between">
            <Text style={styles.label}>Quality:</Text>
            <Text style={styles.value}>{getConnectionQuality()}</Text>
          </HStack>
          
          <HStack justifyContent="space-between">
            <Text style={styles.label}>Last Sync:</Text>
            <Text style={styles.value}>{formatLastSync()}</Text>
          </HStack>
        </VStack>

        {/* Offline Mode Toggle */}
        <HStack justifyContent="space-between" alignItems="center" mt="2">
          <Text style={styles.label}>Force Offline Mode:</Text>
          <TouchableOpacity onPress={handleToggleOfflineMode}>
            <Badge
              colorScheme={offlineMode ? 'warning' : 'gray'}
              variant={offlineMode ? 'solid' : 'outline'}
            >
              {offlineMode ? 'ON' : 'OFF'}
            </Badge>
          </TouchableOpacity>
        </HStack>
      </VStack>
    </Box>
  );
};

/**
 * Sync progress indicator
 */
export const SyncProgressIndicator: React.FC = () => {
  const syncProgress = useSyncProgress();
  
  if (!syncProgress || syncProgress.total === 0) {
    return null;
  }

  const progressPercentage = (syncProgress.completed / syncProgress.total) * 100;
  const isCompleted = syncProgress.completed === syncProgress.total && !syncProgress.currentOperation;

  return (
    <Box bg="white" p="3" rounded="lg" shadow="1" mb="2">
      <VStack space="2">
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space="2" alignItems="center">
            <Text style={{fontSize: 16}}>🔄</Text>
            <Text style={styles.syncTitle}>Synchronizing</Text>
          </HStack>
          
          <Text style={styles.syncCounter}>
            {syncProgress.completed}/{syncProgress.total}
          </Text>
        </HStack>

        <Progress
          value={progressPercentage}
          colorScheme="blue"
          size="sm"
          rounded="full"
        />

        {syncProgress.currentOperation && (
          <Text style={styles.syncOperation} numberOfLines={1}>
            {syncProgress.currentOperation}
          </Text>
        )}

        {syncProgress.failed > 0 && (
          <HStack space="1" alignItems="center">
            <Text style={{fontSize: 12}}>❌</Text>
            <Text style={styles.syncError}>
              {syncProgress.failed} failed
            </Text>
          </HStack>
        )}

        {isCompleted && (
          <HStack space="1" alignItems="center">
            <Text style={{fontSize: 12}}>✅</Text>
            <Text style={styles.syncSuccess}>
              Sync completed
            </Text>
          </HStack>
        )}
      </VStack>
    </Box>
  );
};

/**
 * Simple status bar for minimal UI
 */
export const StatusBar: React.FC = () => {
  const isOnline = useIsOnline();
  const syncProgress = useSyncProgress();
  const showIndicator = useShowOfflineIndicator();
  
  if (!showIndicator && !syncProgress) {
    return null;
  }

  return (
    <Box bg={isOnline ? 'success.500' : 'error.500'} py="1">
      <HStack justifyContent="center" alignItems="center" space="2">
        {syncProgress ? (
          <>
            <Text style={{fontSize: 12, color: 'white'}}>🔄</Text>
            <Text style={styles.statusBarText}>
              Syncing {syncProgress.completed}/{syncProgress.total}
            </Text>
          </>
        ) : (
          <>
            <Text style={{fontSize: 12, color: 'white'}}>{isOnline ? '📶' : '📵'}</Text>
            <Text style={styles.statusBarText}>
              {isOnline ? 'Online' : 'Offline Mode'}
            </Text>
          </>
        )}
      </HStack>
    </Box>
  );
};

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  label: {
    fontSize: 14,
    color: '#6B7280',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  syncTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  syncCounter: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6B7280',
  },
  syncOperation: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  syncError: {
    fontSize: 12,
    color: '#EF4444',
  },
  syncSuccess: {
    fontSize: 12,
    color: '#10B981',
  },
  statusBarText: {
    fontSize: 12,
    color: 'white',
    fontWeight: '500',
  },
});