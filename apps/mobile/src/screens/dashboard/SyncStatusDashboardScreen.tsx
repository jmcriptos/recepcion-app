import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Progress,
  ScrollView,
  Alert,
  AlertIcon,
  RefreshControl,
  Divider,
  Pressable,
  useToast,
} from 'native-base';
import { useAuthStore } from '../../stores/auth-store';
import { useOfflineStore } from '../../stores/offline-store';
import { SyncStatusCounter } from '../../components/sync/SyncStatusCounter';
import AutomaticSyncService from '../../services/automatic-sync-service';
import SyncQueueService from '../../services/sync-queue-service';

interface SyncError {
  id: string;
  operation_type: string;
  entity_id: string;
  error_message?: string;
  error_category: 'network' | 'validation' | 'server' | 'unknown';
  retry_count: number;
  max_retries: number;
  last_attempt_at?: string;
  created_at: string;
  can_retry: boolean;
}

export const SyncStatusDashboardScreen: React.FC = () => {
  const { isSupervisor } = useAuthStore();
  const { networkStatus, syncProgress, isAutoSyncEnabled, lastSyncTime } = useOfflineStore();
  const toast = useToast();
  
  const [refreshing, setRefreshing] = useState(false);
  const [syncErrors, setSyncErrors] = useState<SyncError[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<'healthy' | 'warning' | 'error'>('healthy');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  
  const automaticSyncService = AutomaticSyncService.getInstance();
  const syncQueueService = SyncQueueService.getInstance();

  useEffect(() => {
    if (isSupervisor()) {
      loadSyncStatus();
      loadSyncErrors();
    }
  }, []);

  const loadSyncStatus = async () => {
    try {
      const stats = await syncQueueService.getQueueStats();
      setQueueStats(stats);
      
      // Determine system health
      let health: 'healthy' | 'warning' | 'error' = 'healthy';
      if (!networkStatus.isConnected && stats.totalPending > 0) {
        health = 'warning';
      } else if (stats.failedOperations > 5) {
        health = 'error';
      }
      setSystemHealth(health);
    } catch (error) {
      console.error('Failed to load sync status:', error);
    }
  };

  const loadSyncErrors = async () => {
    try {
      // Use the enhanced getSyncErrors method
      const errors = await syncQueueService.getSyncErrors();
      setSyncErrors(errors);
    } catch (error) {
      console.error('Failed to load sync errors:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadSyncStatus(),
        loadSyncErrors(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const handleForceSync = async () => {
    if (!networkStatus.isConnected) {
      toast.show({
        title: '📡 Sin Conexión',
        description: 'Necesitas conexión a internet para sincronizar',
        placement: 'top',
        duration: 5000,
      });
      return;
    }

    setIsManualSyncing(true);
    try {
      const result = await automaticSyncService.forceSyncNow();
      
      toast.show({
        title: '✅ Sincronización Completada',
        description: `${result.completed} registros sincronizados, ${result.failed} fallidos`,
        placement: 'top',
        duration: 5000,
      });

      // Refresh data after sync
      await handleRefresh();
    } catch (error) {
      console.error('Manual sync failed:', error);
      toast.show({
        title: '❌ Error de Sincronización',
        description: String(error),
        placement: 'top',
        duration: 8000,
      });
    } finally {
      setIsManualSyncing(false);
    }
  };

  const handleRetryFailedOperation = async (errorId: string, entityId: string) => {
    try {
      // Use the enhanced retry method
      await automaticSyncService.retryFailedOperation(errorId);
      
      toast.show({
        title: '🔄 Reintentando',
        description: `Reintentando sincronización para ${entityId}`,
        placement: 'top',
        duration: 3000,
      });

      // Refresh data
      await handleRefresh();
    } catch (error) {
      toast.show({
        title: '❌ Error al Reintentar',
        description: String(error),
        placement: 'top',
        duration: 5000,
      });
    }
  };

  const getHealthStatusColor = () => {
    switch (systemHealth) {
      case 'healthy': return 'green.500';
      case 'warning': return 'orange.500';
      case 'error': return 'red.500';
      default: return 'gray.500';
    }
  };

  const getHealthStatusText = () => {
    switch (systemHealth) {
      case 'healthy': return 'Sistema Saludable';
      case 'warning': return 'Advertencias';
      case 'error': return 'Errores Críticos';
      default: return 'Desconocido';
    }
  };

  const formatErrorType = (operationType: string) => {
    switch (operationType) {
      case 'create_registration': return 'Crear Registro';
      case 'upload_photo': return 'Subir Foto';
      case 'update_user': return 'Actualizar Usuario';
      default: return operationType;
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  if (!isSupervisor()) {
    return (
      <Box flex={1} justifyContent="center" alignItems="center" p={6}>
        <Text fontSize="lg" color="red.500" textAlign="center">
          ❌ Acceso denegado
        </Text>
        <Text color="gray.600" textAlign="center" mt={2}>
          Solo los supervisores pueden acceder al dashboard de sincronización
        </Text>
      </Box>
    );
  }

  const pendingCount = queueStats?.totalPending || 0;
  const failedCount = queueStats?.failedOperations || 0;
  const registrationCount = queueStats?.byType?.create_registration || 0;

  return (
    <ScrollView
      flex={1}
      bg="gray.50"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          colors={['#2563EB']}
          tintColor="#2563EB"
        />
      }
    >
      <VStack space={4} p={4} pb={8}>
        {/* Header */}
        <Box bg="white" borderRadius="lg" p={4} shadow={1}>
          <HStack justifyContent="space-between" alignItems="center" mb={4}>
            <Text fontSize="xl" fontWeight="bold">
              📊 Dashboard de Sincronización
            </Text>
            <Badge bg={getHealthStatusColor()} _text={{ color: 'white', fontWeight: 'bold' }}>
              {getHealthStatusText()}
            </Badge>
          </HStack>

          {/* System Status Overview */}
          <VStack space={3}>
            <HStack justifyContent="space-between">
              <Text fontSize="md" color="gray.600">Estado del Sistema:</Text>
              <Text fontSize="md" fontWeight="semibold" color={getHealthStatusColor()}>
                {getHealthStatusText()}
              </Text>
            </HStack>
            
            <HStack justifyContent="space-between">
              <Text fontSize="md" color="gray.600">Red:</Text>
              <HStack space={2} alignItems="center">
                <Text fontSize="lg">{networkStatus.isConnected ? '🌐' : '📡'}</Text>
                <Text fontSize="md" color={networkStatus.isConnected ? 'green.600' : 'orange.600'}>
                  {networkStatus.isConnected ? 'Conectado' : 'Sin conexión'}
                </Text>
              </HStack>
            </HStack>

            <HStack justifyContent="space-between">
              <Text fontSize="md" color="gray.600">Sincronización Auto:</Text>
              <Badge bg={isAutoSyncEnabled ? 'green.500' : 'gray.500'} _text={{ color: 'white' }}>
                {isAutoSyncEnabled ? 'Activada' : 'Desactivada'}
              </Badge>
            </HStack>

            {lastSyncTime && (
              <HStack justifyContent="space-between">
                <Text fontSize="md" color="gray.600">Última Sync:</Text>
                <Text fontSize="md" color="green.600" fontWeight="semibold">
                  {formatDate(lastSyncTime)}
                </Text>
              </HStack>
            )}
          </VStack>
        </Box>

        {/* Manual Sync Controls */}
        <Box bg="white" borderRadius="lg" p={4} shadow={1}>
          <Text fontSize="lg" fontWeight="bold" mb={3}>
            🔄 Controles de Sincronización
          </Text>
          
          <VStack space={3}>
            {syncProgress && syncProgress.total > 0 ? (
              <VStack space={2}>
                <HStack justifyContent="space-between">
                  <Text fontSize="sm" color="blue.600" fontWeight="semibold">
                    Sincronizando...
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
            ) : (
              <Button
                size="lg"
                bg="blue.500"
                onPress={handleForceSync}
                isDisabled={!networkStatus.isConnected || isManualSyncing}
                isLoading={isManualSyncing}
                leftIcon={<Text fontSize="lg">🔄</Text>}
                _text={{ fontSize: 'lg', fontWeight: 'bold' }}
                _pressed={{ bg: 'blue.600' }}
                minH="60px" // Industrial UI: Large touch target
              >
                {isManualSyncing ? 'Sincronizando...' : 'Forzar Sincronización'}
              </Button>
            )}

            {!networkStatus.isConnected && (
              <Alert status="warning" borderRadius="md">
                <AlertIcon />
                <Text fontSize="sm" color="orange.700">
                  Necesitas conexión a internet para la sincronización manual
                </Text>
              </Alert>
            )}
          </VStack>
        </Box>

        {/* Queue Statistics */}
        {queueStats && (
          <Box bg="white" borderRadius="lg" p={4} shadow={1}>
            <Text fontSize="lg" fontWeight="bold" mb={3}>
              📊 Estadísticas de Cola
            </Text>
            
            <VStack space={3}>
              <HStack justifyContent="space-around">
                <VStack alignItems="center" flex={1}>
                  <Text fontSize="2xl" fontWeight="bold" color="orange.600">
                    {pendingCount}
                  </Text>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Pendientes
                  </Text>
                </VStack>
                
                <VStack alignItems="center" flex={1}>
                  <Text fontSize="2xl" fontWeight="bold" color="red.600">
                    {failedCount}
                  </Text>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Fallidos
                  </Text>
                </VStack>
                
                <VStack alignItems="center" flex={1}>
                  <Text fontSize="2xl" fontWeight="bold" color="blue.600">
                    {registrationCount}
                  </Text>
                  <Text fontSize="sm" color="gray.600" textAlign="center">
                    Registros
                  </Text>
                </VStack>
              </HStack>

              {(pendingCount > 0 || failedCount > 0) && (
                <Box bg="orange.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="orange.400">
                  <Text fontSize="sm" color="orange.700" fontWeight="semibold">
                    ⚠️ Elementos en Cola
                  </Text>
                  <Text fontSize="xs" color="orange.600" mt={1}>
                    {pendingCount} elementos pendientes, {failedCount} fallidos. 
                    La sincronización automática procesará estos elementos cuando haya conexión.
                  </Text>
                </Box>
              )}
            </VStack>
          </Box>
        )}

        {/* Sync Errors */}
        {syncErrors.length > 0 && (
          <Box bg="white" borderRadius="lg" p={4} shadow={1}>
            <Text fontSize="lg" fontWeight="bold" mb={3}>
              ❌ Errores de Sincronización ({syncErrors.length})
            </Text>
            
            <VStack space={3}>
              {syncErrors.slice(0, 10).map((error) => (
                <Box key={error.id} bg="red.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="red.400">
                  <VStack space={2}>
                    <HStack justifyContent="space-between" alignItems="center">
                      <VStack flex={1}>
                        <Text fontSize="sm" fontWeight="semibold" color="red.700">
                          {formatErrorType(error.operation_type)}
                        </Text>
                        <Text fontSize="xs" color="red.600">
                          ID: {error.entity_id}
                        </Text>
                      </VStack>
                      <Badge bg="red.500" _text={{ color: 'white', fontSize: 'xs' }}>
                        {error.retry_count}/{error.max_retries}
                      </Badge>
                    </HStack>
                    
                    {error.error_message && (
                      <Text fontSize="xs" color="red.600">
                        Error: {error.error_message}
                      </Text>
                    )}
                    
                    <HStack justifyContent="space-between" alignItems="center">
                      <Text fontSize="xs" color="gray.500">
                        {error.last_attempt_at ? 
                          `Último intento: ${formatDate(error.last_attempt_at)}` : 
                          `Creado: ${formatDate(error.created_at)}`}
                      </Text>
                      
                      {error.can_retry && (
                        <Button
                          size="sm"
                          variant="outline"
                          colorScheme="blue"
                          onPress={() => handleRetryFailedOperation(error.id, error.entity_id)}
                          _text={{ fontSize: 'xs' }}
                          minH="40px"
                        >
                          Reintentar
                        </Button>
                      )}
                    </HStack>
                  </VStack>
                </Box>
              ))}
              
              {syncErrors.length > 10 && (
                <Text fontSize="sm" color="gray.500" textAlign="center">
                  ... y {syncErrors.length - 10} errores más
                </Text>
              )}
            </VStack>
          </Box>
        )}

        {/* Real-time Sync Status from SyncStatusCounter */}
        <Box bg="white" borderRadius="lg" p={4} shadow={1}>
          <Text fontSize="lg" fontWeight="bold" mb={3}>
            📱 Estado en Tiempo Real
          </Text>
          <SyncStatusCounter showDetails={true} />
        </Box>
      </VStack>
    </ScrollView>
  );
};

export default SyncStatusDashboardScreen;