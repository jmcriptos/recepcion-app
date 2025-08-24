import React, { useEffect, useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Badge,
  Button,
  Progress,
  useToast,
  Alert,
  AlertIcon,
  Fade,
} from 'native-base';
import { useOfflineStore } from '../../stores/offline-store';
import { useRecentRegistrations } from '../../stores/registration-store';
import SyncQueueService from '../../services/sync-queue-service';
import SyncNotificationService from '../../services/sync-notification-service';
import BackgroundSyncCoordinator from '../../services/background-sync-coordinator';

interface SyncStatusCounterProps {
  showDetails?: boolean;
  onPress?: () => void;
}

export const SyncStatusCounter: React.FC<SyncStatusCounterProps> = ({
  showDetails = false,
  onPress,
}) => {
  const { networkStatus, syncProgress, isAutoSyncEnabled } = useOfflineStore();
  const recentRegistrations = useRecentRegistrations();
  const toast = useToast();
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [syncCoordinator, setSyncCoordinator] = useState<BackgroundSyncCoordinator | null>(null);
  
  // Initialize sync coordinator and notification service
  useEffect(() => {
    const coordinator = BackgroundSyncCoordinator.getInstance();
    const notificationService = SyncNotificationService.getInstance();
    
    setSyncCoordinator(coordinator);
    
    // Subscribe to sync progress updates
    const unsubscribeSyncProgress = coordinator.addSyncProgressListener((progress) => {
      if (progress.completed > 0 && !progress.currentOperation) {
        setLastSyncTime(new Date().toLocaleTimeString());
        notificationService.notifyBackgroundSyncCompleted(progress.completed, progress.failed);
      }
    });
    
    // Subscribe to toast notifications
    const unsubscribeNotifications = notificationService.addNotificationListener((notification) => {
      toast.show({
        title: notification.title,
        description: notification.message,
        placement: 'top',
        duration: notification.duration,
      });
    });
    
    return () => {
      unsubscribeSyncProgress();
      unsubscribeNotifications();
    };
  }, [toast]);

  const pendingCount = recentRegistrations.filter(r => r.sync_status === 'pending').length;
  const failedCount = recentRegistrations.filter(r => r.sync_status === 'failed').length;
  const syncedCount = recentRegistrations.filter(r => r.sync_status === 'synced').length;
  const totalCount = recentRegistrations.length;

  const handleManualSync = async () => {
    if (!networkStatus.isConnected) {
      const notificationService = SyncNotificationService.getInstance();
      notificationService.showNotification({
        type: 'warning',
        title: '📡 Sin Conexión',
        message: 'Necesitas conexión a internet para sincronizar',
        duration: 5000,
      });
      return;
    }

    try {
      const notificationService = SyncNotificationService.getInstance();
      
      if (syncCoordinator) {
        notificationService.notifySyncStarted(pendingCount);
        
        const result = await syncCoordinator.forceSyncNow();
        notificationService.notifySyncCompleted(result);
        
        if (result.completed > 0) {
          setLastSyncTime(new Date().toLocaleTimeString());
        }
      } else {
        // Fallback to direct sync queue processing
        const syncQueueService = SyncQueueService.getInstance();
        notificationService.notifySyncStarted(pendingCount);
        
        const result = await syncQueueService.processQueue();
        notificationService.notifySyncCompleted(result);
      }
    } catch (error) {
      console.error('Manual sync failed:', error);
      const notificationService = SyncNotificationService.getInstance();
      notificationService.notifySyncError(String(error));
    }
  };

  const getSyncStatusColor = () => {
    if (!networkStatus.isConnected) return 'orange.500';
    if (failedCount > 0) return 'red.500';
    if (pendingCount > 0) return 'yellow.500';
    return 'green.500';
  };

  const getSyncStatusText = () => {
    if (!networkStatus.isConnected) return 'Offline';
    if (syncProgress && syncProgress.total > 0) return 'Sincronizando...';
    if (failedCount > 0) return 'Errores de sync';
    if (pendingCount > 0) return 'Pendiente';
    return 'Sincronizado';
  };

  if (!showDetails) {
    // Compact counter for navigation header
    return (
      <Button
        variant="ghost"
        size="sm"
        onPress={onPress}
        _pressed={{ bg: 'gray.200' }}
        leftIcon={
          <Box
            width="8px"
            height="8px"
            borderRadius="full"
            bg={getSyncStatusColor()}
          />
        }
      >
        <Text fontSize="sm" fontWeight="semibold">
          {pendingCount > 0 ? pendingCount : '✓'}
        </Text>
      </Button>
    );
  }

  // Detailed sync status component
  return (
    <Box bg="white" borderRadius="md" shadow={2} p={4}>
      <VStack space={4}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <HStack space={2} alignItems="center">
            <Text fontSize="lg" fontWeight="bold">
              Estado de Sincronización
            </Text>
            <Badge 
              bg={getSyncStatusColor()} 
              _text={{ color: 'white', fontSize: 'xs', fontWeight: 'bold' }}
            >
              {getSyncStatusText()}
            </Badge>
          </HStack>

          {networkStatus.isConnected && pendingCount > 0 && (
            <Button
              size="sm"
              bg="blue.500"
              onPress={handleManualSync}
              isDisabled={!!(syncProgress?.total && syncProgress.total > 0)}
              _text={{ fontSize: 'xs', fontWeight: 'bold' }}
            >
              Sincronizar
            </Button>
          )}
        </HStack>

        {/* Network Status */}
        <HStack space={2} alignItems="center">
          <Text fontSize="lg">
            {networkStatus.isConnected ? '🌐' : '📡'}
          </Text>
          <Text fontSize="md" color={networkStatus.isConnected ? 'green.600' : 'orange.600'}>
            {networkStatus.isConnected ? 'Conectado' : 'Sin conexión'}
          </Text>
          {networkStatus.type && (
            <Text fontSize="sm" color="gray.500">
              ({networkStatus.type})
            </Text>
          )}
        </HStack>

        {/* Sync Progress */}
        {syncProgress && syncProgress.total > 0 && (
          <VStack space={2}>
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" color="blue.600" fontWeight="semibold">
                Sincronizando registros...
              </Text>
              <Text fontSize="sm" color="gray.600">
                {syncProgress.completed}/{syncProgress.total}
              </Text>
            </HStack>
            
            <Progress 
              value={(syncProgress.completed / syncProgress.total) * 100} 
              colorScheme="blue"
              size="sm"
            />
            
            {syncProgress.currentOperation && (
              <Text fontSize="xs" color="gray.500">
                {syncProgress.currentOperation}
              </Text>
            )}
          </VStack>
        )}

        {/* Registration Statistics */}
        {totalCount > 0 && (
          <VStack space={2}>
            <Text fontSize="md" fontWeight="semibold">
              Registros de Hoy ({totalCount})
            </Text>
            
            <HStack space={4} justifyContent="space-around">
              <VStack alignItems="center">
                <Text fontSize="xl" color="green.600" fontWeight="bold">
                  {syncedCount}
                </Text>
                <Text fontSize="xs" color="gray.600" textAlign="center">
                  Sincronizados
                </Text>
              </VStack>
              
              <VStack alignItems="center">
                <Text fontSize="xl" color="orange.600" fontWeight="bold">
                  {pendingCount}
                </Text>
                <Text fontSize="xs" color="gray.600" textAlign="center">
                  Pendientes
                </Text>
              </VStack>
              
              <VStack alignItems="center">
                <Text fontSize="xl" color="red.600" fontWeight="bold">
                  {failedCount}
                </Text>
                <Text fontSize="xs" color="gray.600" textAlign="center">
                  Fallidos
                </Text>
              </VStack>
            </HStack>
          </VStack>
        )}

        {/* Auto-sync Status */}
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="sm" color="gray.600">
            Sincronización automática:
          </Text>
          <Badge 
            bg={isAutoSyncEnabled ? 'green.500' : 'gray.500'}
            _text={{ color: 'white', fontSize: 'xs' }}
          >
            {isAutoSyncEnabled ? 'Activada' : 'Desactivada'}
          </Badge>
        </HStack>

        {/* Last Sync Time */}
        {lastSyncTime && (
          <Fade in={true}>
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" color="gray.600">
                Última sincronización:
              </Text>
              <Text fontSize="sm" color="green.600" fontWeight="semibold">
                {lastSyncTime}
              </Text>
            </HStack>
          </Fade>
        )}

        {/* Offline Info */}
        {!networkStatus.isConnected && pendingCount > 0 && (
          <Box bg="orange.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="orange.400">
            <Text fontSize="sm" color="orange.700" fontWeight="semibold">
              📱 Trabajando en modo offline
            </Text>
            <Text fontSize="xs" color="orange.600" mt={1}>
              {pendingCount} registro{pendingCount > 1 ? 's' : ''} se sincronizar{pendingCount > 1 ? 'án' : 'á'} automáticamente cuando se restablezca la conexión
            </Text>
          </Box>
        )}

        {/* Failed Sync Warning */}
        {failedCount > 0 && (
          <Box bg="red.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="red.400">
            <Text fontSize="sm" color="red.700" fontWeight="semibold">
              ⚠️ Errores de sincronización
            </Text>
            <Text fontSize="xs" color="red.600" mt={1}>
              {failedCount} registro{failedCount > 1 ? 's' : ''} falló en la sincronización. Verifica tu conexión y vuelve a intentar.
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};