import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  Progress,
  Alert,
  AlertIcon,
  AlertDialog,
  useToast,
  Badge,
  Divider,
} from 'native-base';
import { useAuthStore } from '../../stores/auth-store';
import { useOfflineStore } from '../../stores/offline-store';
import AutomaticSyncService from '../../services/automatic-sync-service';
import SyncQueueService from '../../services/sync-queue-service';
import { SyncProgress } from '../../types/offline';

interface ManualSyncControlsProps {
  onSyncStarted?: () => void;
  onSyncCompleted?: (result: SyncProgress) => void;
  onSyncError?: (error: string) => void;
  showQueueStats?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const ManualSyncControls: React.FC<ManualSyncControlsProps> = ({
  onSyncStarted,
  onSyncCompleted,
  onSyncError,
  showQueueStats = true,
  size = 'md',
}) => {
  const { isSupervisor } = useAuthStore();
  const { networkStatus, syncProgress, isAutoSyncEnabled } = useOfflineStore();
  const toast = useToast();
  
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [lastSyncResult, setLastSyncResult] = useState<SyncProgress | null>(null);
  
  const automaticSyncService = AutomaticSyncService.getInstance();
  const syncQueueService = SyncQueueService.getInstance();
  
  React.useEffect(() => {
    if (showQueueStats) {
      loadQueueStats();
    }
  }, [showQueueStats]);

  const loadQueueStats = async () => {
    try {
      const stats = await syncQueueService.getQueueStats();
      setQueueStats(stats);
    } catch (error) {
      console.error('Failed to load queue stats:', error);
    }
  };

  const handleForceSync = async () => {
    if (!isSupervisor()) {
      toast.show({
        title: '❌ Acceso Denegado',
        description: 'Solo los supervisores pueden forzar sincronización',
        placement: 'top',
        duration: 5000,
      });
      return;
    }

    if (!networkStatus.isConnected) {
      toast.show({
        title: '📡 Sin Conexión',
        description: 'Necesitas conexión a internet para sincronizar manualmente',
        placement: 'top',
        duration: 5000,
      });
      return;
    }

    // If sync is already in progress, don't start another
    if (syncProgress && syncProgress.total > 0) {
      toast.show({
        title: '⚠️ Sincronización en Progreso',
        description: 'Ya hay una sincronización en proceso, espera a que termine',
        placement: 'top',
        duration: 3000,
      });
      return;
    }

    // Show confirmation dialog for manual sync
    setShowConfirmDialog(true);
  };

  const confirmForceSync = async () => {
    setShowConfirmDialog(false);
    setIsManualSyncing(true);
    
    if (onSyncStarted) {
      onSyncStarted();
    }

    try {
      toast.show({
        title: '🔄 Iniciando Sincronización',
        description: 'Forzando sincronización manual...',
        placement: 'top',
        duration: 2000,
      });

      const result = await automaticSyncService.forceSyncNow();
      setLastSyncResult(result);

      // Success notification
      toast.show({
        title: '✅ Sincronización Completada',
        description: `${result.completed} registros sincronizados, ${result.failed} errores`,
        placement: 'top',
        duration: 5000,
      });

      // Reload stats after sync
      if (showQueueStats) {
        await loadQueueStats();
      }

      if (onSyncCompleted) {
        onSyncCompleted(result);
      }
    } catch (error) {
      const errorMsg = String(error);
      console.error('Manual sync failed:', error);
      
      toast.show({
        title: '❌ Error de Sincronización',
        description: errorMsg,
        placement: 'top',
        duration: 8000,
      });

      if (onSyncError) {
        onSyncError(errorMsg);
      }
    } finally {
      setIsManualSyncing(false);
    }
  };

  const getSyncButtonSize = () => {
    switch (size) {
      case 'sm': return { minH: '45px', fontSize: 'sm' };
      case 'lg': return { minH: '65px', fontSize: 'lg' };
      default: return { minH: '55px', fontSize: 'md' };
    }
  };

  const getButtonVariant = () => {
    if (!networkStatus.isConnected) return { bg: 'gray.400', _pressed: { bg: 'gray.500' } };
    if (isManualSyncing || (syncProgress && syncProgress.total > 0)) {
      return { bg: 'blue.400', _pressed: { bg: 'blue.500' } };
    }
    return { bg: 'blue.500', _pressed: { bg: 'blue.600' } };
  };

  const getButtonText = () => {
    if (isManualSyncing) return 'Sincronizando...';
    if (syncProgress && syncProgress.total > 0) return 'Sincronización Activa';
    return 'Forzar Sincronización';
  };

  const canSync = networkStatus.isConnected && 
                 isSupervisor() && 
                 !isManualSyncing && 
                 !(syncProgress && syncProgress.total > 0);

  const buttonSizes = getSyncButtonSize();
  const buttonVariant = getButtonVariant();

  return (
    <>
      <Box bg="white" borderRadius="lg" p={4} shadow={1}>
        <VStack space={4}>
          {/* Header */}
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize={size === 'lg' ? 'lg' : 'md'} fontWeight="bold">
              🔄 Control Manual de Sync
            </Text>
            
            {isSupervisor() && (
              <Badge bg="blue.500" _text={{ color: 'white', fontSize: 'xs' }}>
                Supervisor
              </Badge>
            )}
          </HStack>

          {/* Current Sync Status */}
          {syncProgress && syncProgress.total > 0 && (
            <VStack space={2}>
              <HStack justifyContent="space-between">
                <Text fontSize="sm" color="blue.600" fontWeight="semibold">
                  Sincronización en Progreso
                </Text>
                <Text fontSize="sm" color="gray.600">
                  {syncProgress.completed}/{syncProgress.total}
                </Text>
              </HStack>
              <Progress 
                value={(syncProgress.completed / syncProgress.total) * 100} 
                colorScheme="blue"
                size="md"
              />
              {syncProgress.currentOperation && (
                <Text fontSize="xs" color="gray.500">
                  {syncProgress.currentOperation}
                </Text>
              )}
            </VStack>
          )}

          {/* Queue Statistics */}
          {showQueueStats && queueStats && (
            <VStack space={2}>
              <Text fontSize="sm" fontWeight="semibold" color="gray.700">
                Estado de la Cola
              </Text>
              <HStack justifyContent="space-around">
                <VStack alignItems="center">
                  <Text fontSize="lg" fontWeight="bold" color="orange.600">
                    {queueStats.totalPending || 0}
                  </Text>
                  <Text fontSize="xs" color="gray.600">Pendientes</Text>
                </VStack>
                <VStack alignItems="center">
                  <Text fontSize="lg" fontWeight="bold" color="red.600">
                    {queueStats.failedOperations || 0}
                  </Text>
                  <Text fontSize="xs" color="gray.600">Fallidos</Text>
                </VStack>
                <VStack alignItems="center">
                  <Text fontSize="lg" fontWeight="bold" color="blue.600">
                    {queueStats.byType?.create_registration || 0}
                  </Text>
                  <Text fontSize="xs" color="gray.600">Registros</Text>
                </VStack>
              </HStack>
            </VStack>
          )}

          {/* Last Sync Result */}
          {lastSyncResult && !isManualSyncing && !(syncProgress && syncProgress.total > 0) && (
            <Box bg="green.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="green.400">
              <Text fontSize="sm" color="green.700" fontWeight="semibold">
                ✅ Última Sincronización Manual
              </Text>
              <Text fontSize="xs" color="green.600" mt={1}>
                {lastSyncResult.completed} completados, {lastSyncResult.failed} fallidos
              </Text>
            </Box>
          )}

          <Divider />

          {/* Manual Sync Button */}
          <VStack space={3}>
            <Button
              size={size}
              {...buttonVariant}
              onPress={handleForceSync}
              isDisabled={!canSync}
              isLoading={isManualSyncing}
              leftIcon={<Text fontSize={buttonSizes.fontSize}>🔄</Text>}
              _text={{ fontSize: buttonSizes.fontSize, fontWeight: 'bold' }}
              minH={buttonSizes.minH}
            >
              {getButtonText()}
            </Button>

            {/* Status Messages */}
            {!networkStatus.isConnected && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm" color="orange.700">
                  Sin conexión a internet - La sincronización manual no está disponible
                </Text>
              </Alert>
            )}

            {!isSupervisor() && (
              <Alert status="info" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm" color="blue.700">
                  Solo los supervisores pueden usar la sincronización manual
                </Text>
              </Alert>
            )}

            {/* Auto Sync Status */}
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="sm" color="gray.600">Sync Automático:</Text>
              <Badge bg={isAutoSyncEnabled ? 'green.500' : 'gray.500'} _text={{ color: 'white', fontSize: 'xs' }}>
                {isAutoSyncEnabled ? 'Activado' : 'Desactivado'}
              </Badge>
            </HStack>
          </VStack>
        </VStack>
      </Box>

      {/* Confirmation Dialog */}
      <AlertDialog isOpen={showConfirmDialog} onClose={() => setShowConfirmDialog(false)}>
        <AlertDialog.Content>
          <AlertDialog.CloseButton />
          <AlertDialog.Header>Confirmar Sincronización Manual</AlertDialog.Header>
          <AlertDialog.Body>
            <VStack space={3}>
              <Text fontSize="md">
                ¿Estás seguro de que quieres forzar una sincronización manual?
              </Text>
              
              {queueStats && queueStats.totalPending > 0 && (
                <Box bg="orange.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="orange.400">
                  <Text fontSize="sm" color="orange.700" fontWeight="semibold">
                    📋 Elementos en Cola
                  </Text>
                  <Text fontSize="sm" color="orange.600" mt={1}>
                    Hay {queueStats.totalPending} elementos pendientes de sincronización. 
                    Esta operación intentará sincronizar todos los elementos pendientes.
                  </Text>
                </Box>
              )}

              <Text fontSize="sm" color="gray.600">
                Esta operación puede tomar varios minutos dependiendo de la cantidad 
                de registros pendientes y la velocidad de la conexión.
              </Text>
            </VStack>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button.Group space={2}>
              <Button
                variant="outline"
                onPress={() => setShowConfirmDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                colorScheme="blue"
                onPress={confirmForceSync}
              >
                Confirmar Sincronización
              </Button>
            </Button.Group>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </>
  );
};

export default ManualSyncControls;