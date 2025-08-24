import React, { useState } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Alert,
  AlertIcon,
  FlatList,
  RefreshControl,
  Modal,
  useToast,
} from 'native-base';
import { ListRenderItem } from 'react-native';

export interface SyncError {
  id: string;
  operation_type: 'create_registration' | 'upload_photo' | 'update_user';
  entity_id: string;
  error_message?: string;
  error_category: 'network' | 'validation' | 'server' | 'unknown';
  retry_count: number;
  max_retries: number;
  last_attempt_at?: string;
  created_at: string;
  can_retry: boolean;
}

interface SyncErrorLogProps {
  errors: SyncError[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
  onRetry?: (error: SyncError) => Promise<void>;
  onClearError?: (errorId: string) => Promise<void>;
  showDetailsModal?: boolean;
}

export const SyncErrorLog: React.FC<SyncErrorLogProps> = ({
  errors,
  isLoading = false,
  onRefresh,
  onRetry,
  onClearError,
  showDetailsModal = true,
}) => {
  const [refreshing, setRefreshing] = useState(false);
  const [selectedError, setSelectedError] = useState<SyncError | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [retryingErrors, setRetryingErrors] = useState<Set<string>>(new Set());
  const toast = useToast();

  const handleRefresh = async () => {
    if (!onRefresh) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRetry = async (error: SyncError) => {
    if (!onRetry || retryingErrors.has(error.id)) return;

    setRetryingErrors(prev => new Set(prev).add(error.id));
    
    try {
      await onRetry(error);
      toast.show({
        title: '🔄 Reintento Iniciado',
        description: `Reintentando operación para ${error.entity_id}`,
        status: 'info',
        duration: 3000,
      });
    } catch (err) {
      toast.show({
        title: '❌ Error al Reintentar',
        description: String(err),
        status: 'error',
        duration: 5000,
      });
    } finally {
      setRetryingErrors(prev => {
        const next = new Set(prev);
        next.delete(error.id);
        return next;
      });
    }
  };

  const handleClearError = async (error: SyncError) => {
    if (!onClearError) return;

    try {
      await onClearError(error.id);
      toast.show({
        title: '✅ Error Eliminado',
        description: 'El error ha sido eliminado del registro',
        status: 'success',
        duration: 3000,
      });
    } catch (err) {
      toast.show({
        title: '❌ Error al Eliminar',
        description: String(err),
        status: 'error',
        duration: 5000,
      });
    }
  };

  const formatOperationType = (operationType: string) => {
    switch (operationType) {
      case 'create_registration': return 'Crear Registro';
      case 'upload_photo': return 'Subir Foto';
      case 'update_user': return 'Actualizar Usuario';
      default: return operationType;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'network': return 'orange.500';
      case 'validation': return 'yellow.500';
      case 'server': return 'red.500';
      default: return 'gray.500';
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'network': return 'Red';
      case 'validation': return 'Validación';
      case 'server': return 'Servidor';
      default: return 'Desconocido';
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

  const getRetryButtonText = (error: SyncError) => {
    if (error.retry_count >= error.max_retries) return 'Máx. intentos';
    if (!error.can_retry) return 'No reintentable';
    return 'Reintentar';
  };

  const renderErrorItem: ListRenderItem<SyncError> = ({ item: error }) => (
    <Box
      bg="white"
      borderRadius="md"
      p={4}
      mb={3}
      shadow={1}
      borderLeftWidth={4}
      borderLeftColor={getCategoryColor(error.error_category)}
    >
      <VStack space={3}>
        {/* Header */}
        <HStack justifyContent="space-between" alignItems="center">
          <VStack flex={1}>
            <Text fontSize="md" fontWeight="semibold" color="gray.800">
              {formatOperationType(error.operation_type)}
            </Text>
            <Text fontSize="sm" color="gray.600">
              ID: {error.entity_id}
            </Text>
          </VStack>
          
          <VStack alignItems="flex-end" space={1}>
            <Badge bg={getCategoryColor(error.error_category)} _text={{ color: 'white', fontSize: 'xs' }}>
              {getCategoryLabel(error.error_category)}
            </Badge>
            <Badge variant="outline" _text={{ fontSize: 'xs' }}>
              Intento {error.retry_count}/{error.max_retries}
            </Badge>
          </VStack>
        </HStack>

        {/* Error Message */}
        {error.error_message && (
          <Box bg="red.50" p={2} borderRadius="sm">
            <Text fontSize="sm" color="red.700" numberOfLines={2}>
              {error.error_message}
            </Text>
          </Box>
        )}

        {/* Timestamps */}
        <VStack space={1}>
          <Text fontSize="xs" color="gray.500">
            Creado: {formatDate(error.created_at)}
          </Text>
          {error.last_attempt_at && (
            <Text fontSize="xs" color="gray.500">
              Último intento: {formatDate(error.last_attempt_at)}
            </Text>
          )}
        </VStack>

        {/* Actions */}
        <HStack space={2} justifyContent="flex-end">
          {showDetailsModal && (
            <Button
              size="sm"
              variant="ghost"
              colorScheme="blue"
              onPress={() => {
                setSelectedError(error);
                setShowModal(true);
              }}
              _text={{ fontSize: 'xs' }}
              minH="40px"
            >
              Detalles
            </Button>
          )}
          
          {onClearError && (
            <Button
              size="sm"
              variant="outline"
              colorScheme="gray"
              onPress={() => handleClearError(error)}
              _text={{ fontSize: 'xs' }}
              minH="40px"
            >
              Eliminar
            </Button>
          )}
          
          {onRetry && error.can_retry && error.retry_count < error.max_retries && (
            <Button
              size="sm"
              colorScheme="blue"
              onPress={() => handleRetry(error)}
              isLoading={retryingErrors.has(error.id)}
              isDisabled={retryingErrors.has(error.id)}
              _text={{ fontSize: 'xs' }}
              minH="40px"
            >
              {getRetryButtonText(error)}
            </Button>
          )}
        </HStack>
      </VStack>
    </Box>
  );

  if (errors.length === 0) {
    return (
      <Box bg="white" borderRadius="lg" p={6} shadow={1}>
        <VStack space={3} alignItems="center">
          <Text fontSize="4xl">✅</Text>
          <Text fontSize="lg" fontWeight="semibold" color="green.600" textAlign="center">
            Sin Errores de Sincronización
          </Text>
          <Text fontSize="sm" color="gray.600" textAlign="center">
            Todos los registros se han sincronizado correctamente
          </Text>
        </VStack>
      </Box>
    );
  }

  return (
    <>
      <Box bg="white" borderRadius="lg" shadow={1} overflow="hidden">
        <Box p={4} bg="red.50" borderBottomWidth={1} borderBottomColor="red.100">
          <HStack justifyContent="space-between" alignItems="center">
            <Text fontSize="lg" fontWeight="bold" color="red.700">
              ❌ Errores de Sincronización ({errors.length})
            </Text>
            {errors.filter(e => e.can_retry && e.retry_count < e.max_retries).length > 0 && (
              <Badge bg="orange.500" _text={{ color: 'white', fontSize: 'xs' }}>
                {errors.filter(e => e.can_retry && e.retry_count < e.max_retries).length} reintentables
              </Badge>
            )}
          </HStack>
        </Box>

        <FlatList
          data={errors}
          renderItem={renderErrorItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                colors={['#2563EB']}
                tintColor="#2563EB"
              />
            ) : undefined
          }
          ListEmptyComponent={
            <Box py={8}>
              <Text fontSize="md" color="gray.500" textAlign="center">
                {isLoading ? 'Cargando errores...' : 'No hay errores para mostrar'}
              </Text>
            </Box>
          }
        />
      </Box>

      {/* Error Details Modal */}
      {showDetailsModal && selectedError && (
        <Modal isOpen={showModal} onClose={() => setShowModal(false)} size="lg">
          <Modal.Content>
            <Modal.CloseButton />
            <Modal.Header>
              <Text fontSize="lg" fontWeight="bold">
                Detalles del Error
              </Text>
            </Modal.Header>
            <Modal.Body>
              <VStack space={4}>
                <VStack space={2}>
                  <Text fontSize="md" fontWeight="semibold">Operación:</Text>
                  <Text fontSize="sm" color="gray.600">
                    {formatOperationType(selectedError.operation_type)}
                  </Text>
                </VStack>

                <VStack space={2}>
                  <Text fontSize="md" fontWeight="semibold">ID de Entidad:</Text>
                  <Text fontSize="sm" color="gray.600" fontFamily="mono">
                    {selectedError.entity_id}
                  </Text>
                </VStack>

                <VStack space={2}>
                  <Text fontSize="md" fontWeight="semibold">Categoría de Error:</Text>
                  <Badge 
                    bg={getCategoryColor(selectedError.error_category)} 
                    _text={{ color: 'white' }}
                    alignSelf="flex-start"
                  >
                    {getCategoryLabel(selectedError.error_category)}
                  </Badge>
                </VStack>

                {selectedError.error_message && (
                  <VStack space={2}>
                    <Text fontSize="md" fontWeight="semibold">Mensaje de Error:</Text>
                    <Box bg="red.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="red.400">
                      <Text fontSize="sm" color="red.700">
                        {selectedError.error_message}
                      </Text>
                    </Box>
                  </VStack>
                )}

                <VStack space={2}>
                  <Text fontSize="md" fontWeight="semibold">Intentos:</Text>
                  <Text fontSize="sm" color="gray.600">
                    {selectedError.retry_count} de {selectedError.max_retries} intentos realizados
                  </Text>
                </VStack>

                <VStack space={2}>
                  <Text fontSize="md" fontWeight="semibold">Fechas:</Text>
                  <VStack space={1}>
                    <Text fontSize="sm" color="gray.600">
                      <Text fontWeight="semibold">Creado:</Text> {formatDate(selectedError.created_at)}
                    </Text>
                    {selectedError.last_attempt_at && (
                      <Text fontSize="sm" color="gray.600">
                        <Text fontWeight="semibold">Último intento:</Text> {formatDate(selectedError.last_attempt_at)}
                      </Text>
                    )}
                  </VStack>
                </VStack>
              </VStack>
            </Modal.Body>
            <Modal.Footer>
              <HStack space={2} justifyContent="flex-end">
                <Button
                  variant="ghost"
                  onPress={() => setShowModal(false)}
                >
                  Cerrar
                </Button>
                {onRetry && selectedError.can_retry && selectedError.retry_count < selectedError.max_retries && (
                  <Button
                    colorScheme="blue"
                    onPress={() => {
                      handleRetry(selectedError);
                      setShowModal(false);
                    }}
                    isLoading={retryingErrors.has(selectedError.id)}
                    isDisabled={retryingErrors.has(selectedError.id)}
                  >
                    Reintentar Ahora
                  </Button>
                )}
              </HStack>
            </Modal.Footer>
          </Modal.Content>
        </Modal>
      )}
    </>
  );
};

export default SyncErrorLog;