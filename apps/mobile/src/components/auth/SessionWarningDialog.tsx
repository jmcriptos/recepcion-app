/**
 * Session Warning Dialog
 * Shows warning when session is about to expire with option to extend
 */

import React, { useEffect, useState } from 'react';
import {
  Modal,
  VStack,
  HStack,
  Text,
  Box,
  Progress,
} from 'native-base';
import { IndustrialButton } from '@components/industrial/IndustrialButton';

interface SessionWarningDialogProps {
  isOpen: boolean;
  remainingTime: number; // in milliseconds
  onExtend: () => void;
  onLogout: () => void;
}

export const SessionWarningDialog: React.FC<SessionWarningDialogProps> = ({
  isOpen,
  remainingTime,
  onExtend,
  onLogout,
}) => {
  const [timeLeft, setTimeLeft] = useState(remainingTime);

  useEffect(() => {
    setTimeLeft(remainingTime);
  }, [remainingTime]);

  useEffect(() => {
    if (!isOpen || timeLeft <= 0) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        const newTime = Math.max(0, prev - 1000);
        if (newTime === 0) {
          onLogout();
        }
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isOpen, timeLeft, onLogout]);

  const formatTime = (milliseconds: number): string => {
    const minutes = Math.floor(milliseconds / (1000 * 60));
    const seconds = Math.floor((milliseconds % (1000 * 60)) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const getProgressValue = (): number => {
    const totalWarningTime = 15 * 60 * 1000; // 15 minutes
    return Math.max(0, (timeLeft / totalWarningTime) * 100);
  };

  return (
    <Modal isOpen={isOpen} size="lg" avoidKeyboard>
      <Modal.Content maxWidth="90%" bg="white">
        <Modal.Body p={6}>
          <VStack space={6} alignItems="center">
            {/* Warning Icon */}
            <Box
              bg="orange.100"
              p={4}
              borderRadius="full"
              borderWidth={2}
              borderColor="orange.300"
            >
              <Text fontSize="3xl">⚠️</Text>
            </Box>

            {/* Title */}
            <VStack space={2} alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="gray.800" textAlign="center">
                Sesión por expirar
              </Text>
              <Text fontSize="md" color="gray.600" textAlign="center">
                Tu sesión expirará pronto por inactividad
              </Text>
            </VStack>

            {/* Time Display */}
            <VStack space={3} width="100%">
              <HStack justifyContent="space-between" alignItems="center">
                <Text fontSize="sm" color="gray.600">
                  Tiempo restante:
                </Text>
                <Text fontSize="lg" fontWeight="bold" color="orange.600">
                  {formatTime(timeLeft)}
                </Text>
              </HStack>

              {/* Progress Bar */}
              <Progress
                value={getProgressValue()}
                size="md"
                bg="gray.200"
                _filledTrack={{
                  bg: timeLeft < 5 * 60 * 1000 ? 'red.500' : 'orange.400',
                }}
              />
            </VStack>

            {/* Message */}
            <Box bg="orange.50" p={4} borderRadius="md" borderWidth={1} borderColor="orange.200">
              <Text fontSize="sm" color="orange.800" textAlign="center">
                Para continuar trabajando, extiende tu sesión. Si no actúas, 
                serás desconectado automáticamente por seguridad.
              </Text>
            </Box>

            {/* Action Buttons */}
            <VStack space={3} width="100%">
              <IndustrialButton
                title="Extender sesión (4 horas más)"
                onPress={onExtend}
                variant="primary"
                size="large"
                testID="extend-session-button"
              />
              
              <IndustrialButton
                title="Cerrar sesión ahora"
                onPress={onLogout}
                variant="outline"
                size="large"
                testID="logout-now-button"
              />
            </VStack>

            {/* Additional Info */}
            <Text fontSize="xs" color="gray.500" textAlign="center">
              Las sesiones se extienden automáticamente por 4 horas
              para coincidir con los turnos de trabajo industriales
            </Text>
          </VStack>
        </Modal.Body>
      </Modal.Content>
    </Modal>
  );
};