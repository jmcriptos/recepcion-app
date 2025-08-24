/**
 * Sync Progress Indicator Component
 * Shows real-time sync progress with industrial-friendly design
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  Progress,
  Button,
  Fade,
  Spinner,
  useDisclose,
} from 'native-base';
import { SyncProgress } from '../../types/offline';
import { useOfflineStore } from '../../stores/offline-store';
import BackgroundSyncCoordinator from '../../services/background-sync-coordinator';
import SyncNotificationService from '../../services/sync-notification-service';

interface SyncProgressIndicatorProps {
  showMinimized?: boolean;
  allowCancel?: boolean;
  position?: 'top' | 'bottom' | 'center';
}

export const SyncProgressIndicator: React.FC<SyncProgressIndicatorProps> = ({
  showMinimized = false,
  allowCancel = false,
  position = 'bottom',
}) => {
  const { syncProgress } = useOfflineStore();
  const [isMinimized, setIsMinimized] = useState(showMinimized);
  const [syncCoordinator] = useState(() => BackgroundSyncCoordinator.getInstance());
  const [notificationService] = useState(() => SyncNotificationService.getInstance());
  const { isOpen, onOpen, onClose } = useDisclose();

  // Show/hide based on sync progress
  useEffect(() => {
    if (syncProgress && syncProgress.total > 0) {
      onOpen();
    } else {
      onClose();
    }
  }, [syncProgress, onOpen, onClose]);

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  const handleCancelSync = async () => {
    // Note: In a real implementation, you would need to add cancel functionality
    // to the sync coordinator and queue service
    console.log('Cancel sync requested');
  };

  if (!syncProgress || syncProgress.total === 0) {
    return null;
  }

  const { total, completed, failed } = syncProgress;
  const totalProcessed = completed + failed;
  const progressPercentage = Math.round((totalProcessed / total) * 100);
  const isCompleted = totalProcessed >= total;
  const hasErrors = failed > 0;

  const getStatusColor = () => {
    if (hasErrors) return 'orange.500';
    if (isCompleted) return 'green.500';
    return 'blue.500';
  };

  const getStatusIcon = () => {
    if (isCompleted && !hasErrors) return '✅';
    if (hasErrors) return '⚠️';
    return '🔄';
  };

  const getStatusText = () => {
    if (isCompleted && !hasErrors) return 'Sincronización completada';
    if (isCompleted && hasErrors) return `Completado con ${failed} errores`;
    return 'Sincronizando...';
  };

  const summary = notificationService.getSyncStatusSummary(syncProgress);

  return (
    <Fade in={isOpen}>
      <Box
        position="absolute"
        top={position === 'top' ? 4 : undefined}
        bottom={position === 'bottom' ? 4 : undefined}
        left={4}
        right={4}
        zIndex={1000}
        alignSelf="center"
      >
        <Box
          bg="white"
          borderRadius="lg"
          shadow={4}
          borderWidth={1}
          borderColor="gray.200"
          overflow="hidden"
        >
          {/* Header */}
          <HStack
            bg={getStatusColor()}
            px={4}
            py={3}
            alignItems="center"
            justifyContent="space-between"
          >
            <HStack space={2} alignItems="center" flex={1}>
              <Text fontSize="lg">{getStatusIcon()}</Text>
              <VStack flex={1}>
                <Text 
                  fontSize="sm" 
                  fontWeight="bold" 
                  color="white"
                  numberOfLines={1}
                >
                  {getStatusText()}
                </Text>
                <Text 
                  fontSize="xs" 
                  color="white" 
                  opacity={0.9}
                  numberOfLines={1}
                >
                  {completed} completados, {failed} errores
                </Text>
              </VStack>
            </HStack>

            <HStack space={2}>
              {allowCancel && !isCompleted && (
                <Button
                  size="xs"
                  variant="outline"
                  borderColor="white"
                  _text={{ color: 'white', fontSize: 'xs' }}
                  onPress={handleCancelSync}
                >
                  Cancelar
                </Button>
              )}
              <Button
                size="xs"
                variant="ghost"
                onPress={handleToggleMinimize}
                _text={{ color: 'white', fontSize: 'lg' }}
              >
                {isMinimized ? '▲' : '▼'}
              </Button>
            </HStack>
          </HStack>

          {/* Progress Details */}
          {!isMinimized && (
            <VStack space={3} p={4}>
              {/* Progress Bar */}
              <VStack space={2}>
                <HStack justifyContent="space-between" alignItems="center">
                  <Text fontSize="sm" color="gray.600">
                    Progreso de sincronización
                  </Text>
                  <Text fontSize="sm" color="gray.800" fontWeight="semibold">
                    {progressPercentage}%
                  </Text>
                </HStack>
                <Progress 
                  value={progressPercentage} 
                  colorScheme={hasErrors ? 'orange' : 'blue'}
                  size="sm"
                  borderRadius="full"
                />
                <HStack justifyContent="space-between">
                  <Text fontSize="xs" color="gray.500">
                    {totalProcessed}/{total} registros
                  </Text>
                  <Text fontSize="xs" color="gray.500">
                    {isCompleted ? 'Finalizado' : 'En progreso'}
                  </Text>
                </HStack>
              </VStack>

              {/* Current Operation */}
              {syncProgress.currentOperation && !isCompleted && (
                <HStack space={2} alignItems="center">
                  <Spinner size="sm" color="blue.500" />
                  <Text fontSize="xs" color="blue.600" flex={1} numberOfLines={2}>
                    Procesando: {syncProgress.currentOperation}
                  </Text>
                </HStack>
              )}

              {/* Statistics */}
              <HStack space={4} justifyContent="space-around">
                <VStack alignItems="center">
                  <Text fontSize="lg" color="green.600" fontWeight="bold">
                    {completed}
                  </Text>
                  <Text fontSize="xs" color="gray.600" textAlign="center">
                    Exitosos
                  </Text>
                </VStack>
                
                <VStack alignItems="center">
                  <Text fontSize="lg" color="red.600" fontWeight="bold">
                    {failed}
                  </Text>
                  <Text fontSize="xs" color="gray.600" textAlign="center">
                    Fallidos
                  </Text>
                </VStack>
                
                <VStack alignItems="center">
                  <Text fontSize="lg" color="gray.600" fontWeight="bold">
                    {total - totalProcessed}
                  </Text>
                  <Text fontSize="xs" color="gray.600" textAlign="center">
                    Pendientes
                  </Text>
                </VStack>
              </HStack>

              {/* Error Warning */}
              {hasErrors && (
                <Box 
                  bg="orange.50" 
                  p={3} 
                  borderRadius="md" 
                  borderLeftWidth={4} 
                  borderLeftColor="orange.400"
                >
                  <Text fontSize="sm" color="orange.700" fontWeight="semibold">
                    ⚠️ Algunos registros no se sincronizaron
                  </Text>
                  <Text fontSize="xs" color="orange.600" mt={1}>
                    {failed} registro{failed > 1 ? 's' : ''} requieren atención. 
                    Revisa tu conexión y vuelve a intentar.
                  </Text>
                </Box>
              )}

              {/* Completion Message */}
              {isCompleted && !hasErrors && (
                <Box 
                  bg="green.50" 
                  p={3} 
                  borderRadius="md" 
                  borderLeftWidth={4} 
                  borderLeftColor="green.400"
                >
                  <Text fontSize="sm" color="green.700" fontWeight="semibold">
                    ✅ Sincronización completada exitosamente
                  </Text>
                  <Text fontSize="xs" color="green.600" mt={1}>
                    Todos los registros se sincronizaron correctamente.
                  </Text>
                </Box>
              )}
            </VStack>
          )}
        </Box>
      </Box>
    </Fade>
  );
};

export default SyncProgressIndicator;