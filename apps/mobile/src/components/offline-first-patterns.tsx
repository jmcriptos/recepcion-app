/**
 * Offline-First UI Patterns
 * Reusable components for offline-capable user interfaces
 */

import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import {
  Box,
  Button,
  HStack,
  VStack,
  Text,
  Badge,
  Alert as NativeAlert,
  Spinner,
} from 'native-base';
// Temporary text icons to resolve build - replace with proper icons later
import { useIsOnline, useIsOffline } from '../stores/offline-store';

/**
 * Offline-aware button that shows different states
 */
export const OfflineAwareButton: React.FC<{
  children: React.ReactNode;
  onPress: () => Promise<void> | void;
  requiresOnline?: boolean;
  offlineText?: string;
  loadingText?: string;
  variant?: 'solid' | 'outline' | 'ghost';
  colorScheme?: string;
  disabled?: boolean;
  icon?: string;
}> = ({
  children,
  onPress,
  requiresOnline = false,
  offlineText = 'Available offline',
  loadingText = 'Processing...',
  variant = 'solid',
  colorScheme = 'blue',
  disabled = false,
  icon,
}) => {
  const isOnline = useIsOnline();
  const isOffline = useIsOffline();
  const [isLoading, setIsLoading] = useState(false);

  const canExecute = !requiresOnline || isOnline;
  const isDisabled = disabled || isLoading || (requiresOnline && isOffline);

  const handlePress = async () => {
    if (isDisabled) return;

    if (requiresOnline && isOffline) {
      Alert.alert(
        'No Internet Connection',
        'This action requires an internet connection. Please check your connection and try again.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }

    try {
      setIsLoading(true);
      await onPress();
    } catch (error) {
      console.error('Button action failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <VStack space="1" alignItems="center">
      <Button
        variant={variant}
        colorScheme={canExecute ? colorScheme : 'gray'}
        onPress={handlePress}
        disabled={isDisabled}
        leftIcon={
          isLoading ? (
            <Spinner size="sm" color="white" />
          ) : icon ? (
            <Text style={{fontSize: 16}}>📱</Text>
          ) : undefined
        }
        _disabled={{
          opacity: 0.5,
        }}
      >
        {isLoading ? loadingText : children}
      </Button>

      {/* Offline indicator */}
      {!requiresOnline && isOffline && (
        <Badge variant="subtle" colorScheme="success" size="xs">
          {offlineText}
        </Badge>
      )}

      {/* Online required indicator */}
      {requiresOnline && isOffline && (
        <Badge variant="subtle" colorScheme="warning" size="xs">
          Requires internet
        </Badge>
      )}
    </VStack>
  );
};

/**
 * Data list with offline status indicators
 */
export const OfflineDataList: React.FC<{
  data: Array<{
    id: string;
    syncStatus?: 'synced' | 'pending' | 'failed';
    [key: string]: any;
  }>;
  renderItem: (item: any, index: number) => React.ReactNode;
  emptyMessage?: string;
  showSyncStatus?: boolean;
}> = ({
  data,
  renderItem,
  emptyMessage = 'No data available',
  showSyncStatus = true,
}) => {
  // Removed getSyncIcon - using emoji instead

  const getSyncColor = (status: string | undefined) => {
    switch (status) {
      case 'synced':
        return '#10B981';
      case 'pending':
        return '#F59E0B';
      case 'failed':
        return '#EF4444';
      default:
        return '#9CA3AF';
    }
  };

  if (data.length === 0) {
    return (
      <Box flex="1" justifyContent="center" alignItems="center" p="8">
        <Text style={{fontSize: 32, color: '#9CA3AF'}}>📥</Text>
        <Text color="gray.500" mt="4" textAlign="center">
          {emptyMessage}
        </Text>
      </Box>
    );
  }

  return (
    <VStack space="2">
      {data.map((item, index) => (
        <Box key={item.id} position="relative">
          {renderItem(item, index)}
          
          {/* Sync status overlay */}
          {showSyncStatus && item.syncStatus && (
            <Box position="absolute" top="2" right="2">
              <Text style={{fontSize: 12, color: getSyncColor(item.syncStatus)}}>🔄</Text>
            </Box>
          )}
        </Box>
      ))}
    </VStack>
  );
};

/**
 * Form with offline submission capability
 */
export const OfflineForm: React.FC<{
  children: React.ReactNode;
  onSubmit: (data: any) => Promise<void>;
  submitText?: string;
  requiresOnline?: boolean;
  showOfflineWarning?: boolean;
}> = ({
  children,
  onSubmit,
  submitText = 'Submit',
  requiresOnline = false,
  showOfflineWarning = true,
}) => {
  const isOffline = useIsOffline();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (formData: any) => {
    try {
      setIsSubmitting(true);
      await onSubmit(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <VStack space="4">
      {/* Offline warning */}
      {showOfflineWarning && isOffline && !requiresOnline && (
        <NativeAlert status="info" variant="left-accent">
          <HStack space="2" alignItems="center">
            <Text style={{fontSize: 16}}>ℹ️</Text>
            <Text fontSize="sm">
              Data will be saved locally and synced when connection is restored.
            </Text>
          </HStack>
        </NativeAlert>
      )}

      {/* No internet warning for online-required forms */}
      {isOffline && requiresOnline && (
        <NativeAlert status="warning" variant="left-accent">
          <HStack space="2" alignItems="center">
            <Text style={{fontSize: 16}}>⚠️</Text>
            <Text fontSize="sm">
              Internet connection required. Form will be unavailable until connection is restored.
            </Text>
          </HStack>
        </NativeAlert>
      )}

      {children}

      <OfflineAwareButton
        onPress={() => handleSubmit({})}
        requiresOnline={requiresOnline}
        loadingText="Submitting..."
        disabled={isSubmitting}
      >
        {submitText}
      </OfflineAwareButton>
    </VStack>
  );
};

/**
 * Sync status badge for individual items
 */
export const SyncStatusBadge: React.FC<{
  status: 'synced' | 'pending' | 'failed' | undefined;
  showText?: boolean;
  size?: 'xs' | 'sm' | 'md';
}> = ({ status, showText = false, size = 'sm' }) => {
  if (!status) return null;

  const getConfig = () => {
    switch (status) {
      case 'synced':
        return {
          colorScheme: 'success',
          icon: 'cloud-done',
          text: 'Synced',
        };
      case 'pending':
        return {
          colorScheme: 'warning',
          icon: 'cloud-queue',
          text: 'Pending',
        };
      case 'failed':
        return {
          colorScheme: 'error',
          icon: 'cloud-off',
          text: 'Failed',
        };
      default:
        return {
          colorScheme: 'gray',
          icon: 'cloud',
          text: 'Unknown',
        };
    }
  };

  const config = getConfig();

  return (
    <Badge
      colorScheme={config.colorScheme}
      variant="subtle"
      size={size}
      leftIcon={<Text style={{fontSize: 12}}>📱</Text>}
    >
      {showText ? config.text : null}
    </Badge>
  );
};

/**
 * Offline notification banner
 */
export const OfflineBanner: React.FC<{
  onRetry?: () => void;
  onDismiss?: () => void;
}> = ({ onRetry, onDismiss }) => {
  const isOffline = useIsOffline();

  if (!isOffline) return null;

  return (
    <Box bg="warning.500" p="3">
      <HStack justifyContent="space-between" alignItems="center">
        <HStack space="2" alignItems="center" flex="1">
          <Text style={{fontSize: 16, color: 'white'}}>📵</Text>
          <Text color="white" fontSize="sm" flex="1">
            You're offline. Data will sync when connection is restored.
          </Text>
        </HStack>

        <HStack space="2">
          {onRetry && (
            <TouchableOpacity onPress={onRetry}>
              <Text style={{fontSize: 16, color: 'white'}}>🔄</Text>
            </TouchableOpacity>
          )}
          
          {onDismiss && (
            <TouchableOpacity onPress={onDismiss}>
              <Text style={{fontSize: 16, color: 'white'}}>❌</Text>
            </TouchableOpacity>
          )}
        </HStack>
      </HStack>
    </Box>
  );
};

/**
 * Loading state with offline context
 */
export const OfflineLoadingState: React.FC<{
  message?: string;
  showOfflineHint?: boolean;
}> = ({
  message = 'Loading...',
  showOfflineHint = true,
}) => {
  const isOffline = useIsOffline();

  return (
    <Box flex="1" justifyContent="center" alignItems="center" p="8">
      <Spinner size="lg" color="blue.500" />
      <Text mt="4" color="gray.600" textAlign="center">
        {message}
      </Text>
      
      {showOfflineHint && isOffline && (
        <Text mt="2" color="warning.600" fontSize="sm" textAlign="center">
          Loading from local storage
        </Text>
      )}
    </Box>
  );
};

const styles = StyleSheet.create({
  // Add any custom styles if needed
});