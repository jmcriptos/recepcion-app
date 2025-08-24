import React, { useState } from 'react';
import {
  Modal,
  VStack,
  HStack,
  Text,
  Badge,
  Button,
  Box,
  ScrollView,
  Divider,
  useToast,
} from 'native-base';
import { SyncError } from './SyncErrorLog';

interface SyncErrorDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  error: SyncError | null;
  onRetry?: (error: SyncError) => Promise<void>;
  onClearError?: (errorId: string) => Promise<void>;
}

export const SyncErrorDetailsModal: React.FC<SyncErrorDetailsModalProps> = ({
  isOpen,
  onClose,
  error,
  onRetry,
  onClearError,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const toast = useToast();

  if (!error) return null;

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
      case 'network': return 'Error de Red';
      case 'validation': return 'Error de Validación';
      case 'server': return 'Error del Servidor';
      default: return 'Error Desconocido';
    }
  };

  const getCategoryDescription = (category: string) => {
    switch (category) {
      case 'network':
        return 'Este error ocurrió debido a problemas de conectividad. Puede resolverse automáticamente cuando mejore la conexión.';
      case 'validation':
        return 'Los datos no pasaron las validaciones del servidor. Revisa que la información esté completa y sea válida.';
      case 'server':
        return 'El servidor tuvo un problema interno al procesar la solicitud. Contacta al administrador si persiste.';
      default:
        return 'No se pudo categorizar este error. Revisa los detalles y contacta soporte técnico si es necesario.';
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
        second: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const handleRetry = async () => {
    if (!onRetry || !error) return;

    setIsRetrying(true);
    try {
      await onRetry(error);
      toast.show({
        title: '🔄 Reintento Iniciado',
        description: `Reintentando sincronización para ${error.entity_id}`,
        placement: 'top',
        duration: 3000,
      });
      onClose();
    } catch (err) {
      toast.show({
        title: '❌ Error al Reintentar',
        description: String(err),
        placement: 'top',
        duration: 5000,
      });
    } finally {
      setIsRetrying(false);
    }
  };

  const handleClearError = async () => {
    if (!onClearError || !error) return;

    setIsClearing(true);
    try {
      await onClearError(error.id);
      toast.show({
        title: '✅ Error Eliminado',
        description: 'El error ha sido eliminado del registro',
        placement: 'top',
        duration: 3000,
      });
      onClose();
    } catch (err) {
      toast.show({
        title: '❌ Error al Eliminar',
        description: String(err),
        placement: 'top',
        duration: 5000,
      });
    } finally {
      setIsClearing(false);
    }
  };

  const getRetryRecommendation = () => {
    if (error.retry_count >= error.max_retries) {
      return {
        canRetry: false,
        message: 'Este error ha alcanzado el número máximo de reintentos automáticos. Considera eliminar el error si no es crítico o contacta soporte técnico.',
        color: 'red.600'
      };
    }

    if (!error.can_retry) {
      return {
        canRetry: false,
        message: 'Este error no puede ser reintentado automáticamente debido a su naturaleza. Revisa los detalles y corrige el problema manualmente.',
        color: 'orange.600'
      };
    }

    switch (error.error_category) {
      case 'network':
        return {
          canRetry: true,
          message: 'Este error puede resolverse automáticamente con una conexión estable. Intenta reintentar cuando tengas buena conectividad.',
          color: 'orange.600'
        };
      case 'validation':
        return {
          canRetry: false,
          message: 'Este error requiere corrección manual de los datos antes de reintentar. Revisa la información ingresada.',
          color: 'yellow.600'
        };
      case 'server':
        return {
          canRetry: true,
          message: 'El error del servidor puede ser temporal. Intenta reintentar después de unos minutos.',
          color: 'red.600'
        };
      default:
        return {
          canRetry: true,
          message: 'Puedes intentar reintentar esta operación, pero revisa los detalles del error primero.',
          color: 'gray.600'
        };
    }
  };

  const retryRecommendation = getRetryRecommendation();

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="full">
      <Modal.Content maxWidth="90%" maxHeight="90%">
        <Modal.CloseButton />
        <Modal.Header>
          <HStack space={2} alignItems="center">
            <Text fontSize="lg" fontWeight="bold">
              Detalles del Error de Sync
            </Text>
            <Badge bg={getCategoryColor(error.error_category)} _text={{ color: 'white', fontSize: 'xs' }}>
              {getCategoryLabel(error.error_category)}
            </Badge>
          </HStack>
        </Modal.Header>
        
        <Modal.Body>
          <ScrollView showsVerticalScrollIndicator={false}>
            <VStack space={5}>
              {/* Operation Information */}
              <Box>
                <Text fontSize="md" fontWeight="semibold" mb={2}>
                  📋 Información de la Operación
                </Text>
                <Box bg="gray.50" p={3} borderRadius="md">
                  <VStack space={2}>
                    <HStack justifyContent="space-between">
                      <Text fontSize="sm" color="gray.600">Tipo:</Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {formatOperationType(error.operation_type)}
                      </Text>
                    </HStack>
                    <HStack justifyContent="space-between">
                      <Text fontSize="sm" color="gray.600">ID de Entidad:</Text>
                      <Text fontSize="sm" fontFamily="mono" color="blue.600">
                        {error.entity_id}
                      </Text>
                    </HStack>
                    <HStack justifyContent="space-between">
                      <Text fontSize="sm" color="gray.600">Intentos:</Text>
                      <Text fontSize="sm" fontWeight="semibold">
                        {error.retry_count} de {error.max_retries}
                      </Text>
                    </HStack>
                  </VStack>
                </Box>
              </Box>

              {/* Error Category Details */}
              <Box>
                <Text fontSize="md" fontWeight="semibold" mb={2}>
                  🔍 Categoría del Error
                </Text>
                <Box 
                  bg={`${error.error_category === 'network' ? 'orange' : 
                        error.error_category === 'validation' ? 'yellow' : 
                        error.error_category === 'server' ? 'red' : 'gray'}.50`} 
                  p={3} 
                  borderRadius="md" 
                  borderLeftWidth={4} 
                  borderLeftColor={getCategoryColor(error.error_category)}
                >
                  <VStack space={2}>
                    <HStack space={2} alignItems="center">
                      <Badge bg={getCategoryColor(error.error_category)} _text={{ color: 'white' }}>
                        {getCategoryLabel(error.error_category)}
                      </Badge>
                    </HStack>
                    <Text fontSize="sm" color="gray.700">
                      {getCategoryDescription(error.error_category)}
                    </Text>
                  </VStack>
                </Box>
              </Box>

              {/* Error Message */}
              {error.error_message && (
                <Box>
                  <Text fontSize="md" fontWeight="semibold" mb={2}>
                    ❌ Mensaje de Error
                  </Text>
                  <Box bg="red.50" p={3} borderRadius="md" borderLeftWidth={4} borderLeftColor="red.400">
                    <Text fontSize="sm" color="red.700" fontFamily="mono">
                      {error.error_message}
                    </Text>
                  </Box>
                </Box>
              )}

              {/* Timestamps */}
              <Box>
                <Text fontSize="md" fontWeight="semibold" mb={2}>
                  ⏰ Historial de Fechas
                </Text>
                <Box bg="gray.50" p={3} borderRadius="md">
                  <VStack space={2}>
                    <HStack justifyContent="space-between">
                      <Text fontSize="sm" color="gray.600">Creado:</Text>
                      <Text fontSize="sm" fontFamily="mono">
                        {formatDate(error.created_at)}
                      </Text>
                    </HStack>
                    {error.last_attempt_at && (
                      <HStack justifyContent="space-between">
                        <Text fontSize="sm" color="gray.600">Último intento:</Text>
                        <Text fontSize="sm" fontFamily="mono">
                          {formatDate(error.last_attempt_at)}
                        </Text>
                      </HStack>
                    )}
                  </VStack>
                </Box>
              </Box>

              {/* Retry Recommendation */}
              <Box>
                <Text fontSize="md" fontWeight="semibold" mb={2}>
                  💡 Recomendación
                </Text>
                <Box 
                  bg={`${retryRecommendation.canRetry ? 'blue' : 'orange'}.50`} 
                  p={3} 
                  borderRadius="md" 
                  borderLeftWidth={4} 
                  borderLeftColor={retryRecommendation.canRetry ? 'blue.400' : 'orange.400'}
                >
                  <Text fontSize="sm" color={retryRecommendation.color}>
                    {retryRecommendation.message}
                  </Text>
                </Box>
              </Box>

              <Divider />
            </VStack>
          </ScrollView>
        </Modal.Body>
        
        <Modal.Footer>
          <HStack space={2} justifyContent="flex-end" width="100%">
            <Button
              variant="ghost"
              onPress={onClose}
              _text={{ fontSize: 'sm' }}
            >
              Cerrar
            </Button>
            
            {onClearError && (
              <Button
                variant="outline"
                colorScheme="gray"
                onPress={handleClearError}
                isLoading={isClearing}
                isDisabled={isClearing}
                _text={{ fontSize: 'sm' }}
              >
                {isClearing ? 'Eliminando...' : 'Eliminar Error'}
              </Button>
            )}
            
            {onRetry && retryRecommendation.canRetry && error.retry_count < error.max_retries && (
              <Button
                colorScheme="blue"
                onPress={handleRetry}
                isLoading={isRetrying}
                isDisabled={isRetrying}
                _text={{ fontSize: 'sm' }}
              >
                {isRetrying ? 'Reintentando...' : 'Reintentar Ahora'}
              </Button>
            )}
          </HStack>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
};

export default SyncErrorDetailsModal;