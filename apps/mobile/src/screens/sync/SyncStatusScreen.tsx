import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Button,
  ScrollView,
  Badge,
  FlatList,
  useToast,
} from 'native-base';
import { SafeAreaView, RefreshControl } from 'react-native';
import { SyncStatusCounter } from '../../components/sync/SyncStatusCounter';
import { useOfflineStore } from '../../stores/offline-store';
import { useRecentRegistrations, useRegistrationStore } from '../../stores/registration-store';
import { LocalWeightRegistration } from '../../types/offline';
import SyncQueueService from '../../services/sync-queue-service';

interface SyncStatusScreenProps {
  navigation: any;
}

export const SyncStatusScreen: React.FC<SyncStatusScreenProps> = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [syncingAll, setSyncingAll] = useState(false);
  
  const { networkStatus, syncProgress } = useOfflineStore();
  const recentRegistrations = useRecentRegistrations();
  const { loadRecentRegistrations } = useRegistrationStore();
  const toast = useToast();

  const pendingRegistrations = recentRegistrations.filter(r => r.sync_status === 'pending');
  const failedRegistrations = recentRegistrations.filter(r => r.sync_status === 'failed');

  useEffect(() => {
    loadRecentRegistrations();
  }, [loadRecentRegistrations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await loadRecentRegistrations();
    } catch (error) {
      console.error('Failed to refresh registrations:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSyncAll = async () => {
    if (!networkStatus.isConnected) {
      toast.show({
        title: 'Sin conexión',
        description: 'Necesitas conexión a internet para sincronizar',
        placement: 'top',
      });
      return;
    }

    setSyncingAll(true);
    try {
      const syncQueueService = SyncQueueService.getInstance();
      await syncQueueService.processQueue();
      
      toast.show({
        title: 'Sincronización completa',
        description: 'Todos los registros pendientes han sido procesados',
        placement: 'top',
      });
      
      // Refresh the list after sync
      await handleRefresh();
    } catch (error) {
      console.error('Sync all failed:', error);
      toast.show({
        title: 'Error de sincronización',
        description: 'No se pudieron sincronizar todos los registros',
        placement: 'top',
      });
    } finally {
      setSyncingAll(false);
    }
  };

  const handleRetrySingleRegistration = async (registration: LocalWeightRegistration) => {
    if (!networkStatus.isConnected) {
      toast.show({
        title: 'Sin conexión',
        description: 'Necesitas conexión a internet para sincronizar',
        placement: 'top',
      });
      return;
    }

    try {
      const syncQueueService = SyncQueueService.getInstance();
      
      // Re-queue the registration for sync
      await syncQueueService.queueRegistrationCreation(
        {
          weight: registration.weight,
          cut_type: registration.cut_type,
          supplier: registration.supplier,
          local_photo_path: registration.local_photo_path,
          registered_by: registration.registered_by,
        },
        registration.id
      );
      
      toast.show({
        title: 'Registro en cola',
        description: 'El registro se ha agregado a la cola de sincronización',
        placement: 'top',
      });
      
      await handleRefresh();
    } catch (error) {
      console.error('Failed to retry registration:', error);
      toast.show({
        title: 'Error',
        description: 'No se pudo agregar el registro a la cola',
        placement: 'top',
      });
    }
  };

  const formatRegistrationDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit' 
    });
  };

  const getSyncStatusBadge = (status: string) => {
    const configs = {
      pending: { bg: 'orange.500', text: 'Pendiente' },
      synced: { bg: 'green.500', text: 'Sincronizado' },
      failed: { bg: 'red.500', text: 'Fallido' },
    };
    
    const config = configs[status as keyof typeof configs] || configs.pending;
    
    return (
      <Badge bg={config.bg} _text={{ color: 'white', fontSize: 'xs', fontWeight: 'bold' }}>
        {config.text}
      </Badge>
    );
  };

  const renderRegistrationItem = ({ item }: { item: LocalWeightRegistration }) => (
    <Box bg="white" borderRadius="md" shadow={1} p={4} mb={3}>
      <VStack space={2}>
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="md" fontWeight="bold">
            {item.weight} kg • {item.cut_type}
          </Text>
          {getSyncStatusBadge(item.sync_status)}
        </HStack>
        
        <Text fontSize="sm" color="gray.600">
          Proveedor: {item.supplier}
        </Text>
        
        <HStack justifyContent="space-between" alignItems="center">
          <Text fontSize="xs" color="gray.500">
            {formatRegistrationDate(item.created_at)}
          </Text>
          
          {item.sync_status === 'failed' && (
            <Button
              size="xs"
              variant="outline"
              borderColor="red.400"
              onPress={() => handleRetrySingleRegistration(item)}
              _text={{ color: 'red.400', fontSize: 'xs' }}
            >
              Reintentar
            </Button>
          )}
          
          {item.local_photo_path && (
            <Text fontSize="xs" color="blue.600">
              📷 Con foto
            </Text>
          )}
        </HStack>
        
        <Text fontSize="xs" color="gray.400">
          ID: {item.id.slice(0, 8)}...
        </Text>
      </VStack>
    </Box>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView
        flex={1}
        p={4}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        <VStack space={6}>
          {/* Sync Status Overview */}
          <SyncStatusCounter showDetails={true} />

          {/* Sync Actions */}
          {(pendingRegistrations.length > 0 || failedRegistrations.length > 0) && (
            <Box bg="white" borderRadius="md" shadow={2} p={4}>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold">
                  Acciones de Sincronización
                </Text>
                
                <Button
                  bg="blue.500"
                  size="lg"
                  onPress={handleSyncAll}
                  isLoading={syncingAll || (syncProgress?.total || 0) > 0}
                  isDisabled={!networkStatus.isConnected}
                  _text={{ fontSize: 'md', fontWeight: 'bold' }}
                >
                  {syncingAll ? 'Sincronizando...' : 'Sincronizar Todos'}
                </Button>
                
                {!networkStatus.isConnected && (
                  <Text fontSize="sm" color="orange.600" textAlign="center">
                    Conecta a internet para habilitar la sincronización
                  </Text>
                )}
              </VStack>
            </Box>
          )}

          {/* Pending Registrations */}
          {pendingRegistrations.length > 0 && (
            <Box bg="white" borderRadius="md" shadow={2} p={4}>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold" color="orange.600">
                  Registros Pendientes ({pendingRegistrations.length})
                </Text>
                
                <FlatList
                  data={pendingRegistrations}
                  renderItem={renderRegistrationItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </VStack>
            </Box>
          )}

          {/* Failed Registrations */}
          {failedRegistrations.length > 0 && (
            <Box bg="white" borderRadius="md" shadow={2} p={4}>
              <VStack space={4}>
                <Text fontSize="lg" fontWeight="bold" color="red.600">
                  Registros Fallidos ({failedRegistrations.length})
                </Text>
                
                <FlatList
                  data={failedRegistrations}
                  renderItem={renderRegistrationItem}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                />
              </VStack>
            </Box>
          )}

          {/* All Clear Message */}
          {pendingRegistrations.length === 0 && failedRegistrations.length === 0 && recentRegistrations.length > 0 && (
            <Box bg="green.50" borderRadius="md" p={6}>
              <VStack space={2} alignItems="center">
                <Text fontSize="6xl">✅</Text>
                <Text fontSize="lg" fontWeight="bold" color="green.700" textAlign="center">
                  Todo Sincronizado
                </Text>
                <Text fontSize="sm" color="green.600" textAlign="center">
                  Todos los registros de hoy están sincronizados con el servidor
                </Text>
              </VStack>
            </Box>
          )}

          {/* No Registrations */}
          {recentRegistrations.length === 0 && (
            <Box bg="gray.50" borderRadius="md" p={6}>
              <VStack space={2} alignItems="center">
                <Text fontSize="6xl">📝</Text>
                <Text fontSize="lg" fontWeight="bold" color="gray.700" textAlign="center">
                  Sin Registros Hoy
                </Text>
                <Text fontSize="sm" color="gray.600" textAlign="center">
                  No hay registros de peso para mostrar
                </Text>
              </VStack>
            </Box>
          )}
        </VStack>
      </ScrollView>
    </SafeAreaView>
  );
};