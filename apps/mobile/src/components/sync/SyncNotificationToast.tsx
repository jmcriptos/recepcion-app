/**
 * Sync Notification Toast Component
 * Displays sync status notifications with industrial-friendly design
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  HStack,
  VStack,
  Text,
  IconButton,
  Slide,
  Pressable,
  useDisclose,
} from 'native-base';
import { Dimensions } from 'react-native';
import SyncNotificationService from '../../services/sync-notification-service';

interface NotificationData {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  timestamp: string;
}

interface SyncNotificationToastProps {
  autoHide?: boolean;
  position?: 'top' | 'bottom';
}

export const SyncNotificationToast: React.FC<SyncNotificationToastProps> = ({
  autoHide = true,
  position = 'top',
}) => {
  const [currentNotification, setCurrentNotification] = useState<NotificationData | null>(null);
  const [notificationQueue, setNotificationQueue] = useState<NotificationData[]>([]);
  const { isOpen, onOpen, onClose } = useDisclose();
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    const notificationService = SyncNotificationService.getInstance();
    
    const unsubscribe = notificationService.addNotificationListener((notification) => {
      const notificationData: NotificationData = {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        timestamp: notification.timestamp,
      };
      
      setNotificationQueue(prev => [...prev, notificationData]);
    });

    return unsubscribe;
  }, []);

  // Process notification queue
  useEffect(() => {
    if (!currentNotification && notificationQueue.length > 0) {
      const nextNotification = notificationQueue[0];
      setCurrentNotification(nextNotification);
      setNotificationQueue(prev => prev.slice(1));
      onOpen();

      if (autoHide) {
        const timer = setTimeout(() => {
          handleDismiss();
        }, 5000);

        return () => clearTimeout(timer);
      }
    }
  }, [currentNotification, notificationQueue, autoHide, onOpen]);

  const handleDismiss = () => {
    onClose();
    setTimeout(() => {
      setCurrentNotification(null);
    }, 200); // Wait for slide animation
  };

  const getNotificationColors = (type: NotificationData['type']) => {
    switch (type) {
      case 'success':
        return {
          bg: 'green.500',
          borderColor: 'green.600',
          icon: '✅',
          textColor: 'white',
        };
      case 'error':
        return {
          bg: 'red.500',
          borderColor: 'red.600',
          icon: '❌',
          textColor: 'white',
        };
      case 'warning':
        return {
          bg: 'orange.500',
          borderColor: 'orange.600',
          icon: '⚠️',
          textColor: 'white',
        };
      case 'info':
      default:
        return {
          bg: 'blue.500',
          borderColor: 'blue.600',
          icon: 'ℹ️',
          textColor: 'white',
        };
    }
  };

  if (!currentNotification) {
    return null;
  }

  const colors = getNotificationColors(currentNotification.type);

  return (
    <Slide 
      in={isOpen} 
      placement={position}
      duration={200}
    >
      <Box
        position="absolute"
        top={position === 'top' ? 12 : undefined}
        bottom={position === 'bottom' ? 12 : undefined}
        left={4}
        right={4}
        zIndex={9999}
      >
        <Pressable onPress={handleDismiss}>
          <Box
            bg={colors.bg}
            borderRadius="lg"
            borderWidth={2}
            borderColor={colors.borderColor}
            shadow={6}
            maxWidth={screenWidth - 32}
            minHeight={16}
          >
            <HStack space={3} alignItems="flex-start" p={4}>
              {/* Icon */}
              <Box mt={0.5}>
                <Text fontSize="lg">{colors.icon}</Text>
              </Box>

              {/* Content */}
              <VStack flex={1} space={1}>
                <Text 
                  fontSize="md" 
                  fontWeight="bold" 
                  color={colors.textColor}
                  numberOfLines={2}
                >
                  {currentNotification.title}
                </Text>
                <Text 
                  fontSize="sm" 
                  color={colors.textColor}
                  opacity={0.9}
                  numberOfLines={3}
                >
                  {currentNotification.message}
                </Text>
              </VStack>

              {/* Close Button */}
              <IconButton
                size="sm"
                variant="unstyled"
                onPress={handleDismiss}
                icon={
                  <Text color={colors.textColor} fontSize="lg" fontWeight="bold">
                    ×
                  </Text>
                }
                _pressed={{
                  bg: 'rgba(255,255,255,0.2)',
                  borderRadius: 'full',
                }}
              />
            </HStack>

            {/* Progress indicator if there are queued notifications */}
            {notificationQueue.length > 0 && (
              <Box
                position="absolute"
                bottom={1}
                left={4}
                right={4}
                height={1}
                bg="rgba(255,255,255,0.3)"
                borderRadius="full"
              >
                <Box
                  height="100%"
                  bg="white"
                  borderRadius="full"
                  width={`${Math.min(100, (1 / (notificationQueue.length + 1)) * 100)}%`}
                />
              </Box>
            )}
          </Box>
        </Pressable>
      </Box>
    </Slide>
  );
};

export default SyncNotificationToast;