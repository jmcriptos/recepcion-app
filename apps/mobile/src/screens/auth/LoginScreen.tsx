/**
 * Login Screen Component
 * Main authentication screen with user selection for industrial environment
 */

import React, { useEffect, useState } from 'react';
import {
  Box,
  VStack,
  Text,
  Image,
  StatusBar,
} from 'native-base';
import { SafeAreaView } from 'react-native-safe-area-context';
import { UserSelector } from '@components/auth/UserSelector';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';
import { useAuthStore } from '@stores/auth-store';
import { authService } from '@services/auth-service';
import { User } from '../../types/auth';

export const LoginScreen: React.FC = () => {
  const { login, isLoading, error, clearError } = useAuthStore();
  const [users, setUsers] = useState<Pick<User, 'id' | 'name' | 'role'>[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  useEffect(() => {
    // Load users from API
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        const availableUsers = await authService.getAvailableUsers();
        setUsers(availableUsers);
      } catch (err) {
        console.error('Error loading users:', err);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadUsers();
  }, []);

  const handleUserSelect = async (name: string) => {
    try {
      clearError();
      await login(name);
    } catch (err) {
      console.error('Login error:', err);
      // Error is handled by the auth store
    }
  };

  const handleRetry = async () => {
    clearError();
    setLoadingUsers(true);
    try {
      const availableUsers = await authService.getAvailableUsers();
      setUsers(availableUsers);
    } catch (err) {
      console.error('Error loading users on retry:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <StatusBar barStyle="dark-content" backgroundColor="white" />
      <Box flex={1} p={6}>
        <VStack flex={1} space={8} justifyContent="center">
          {/* App Header */}
          <VStack space={4} alignItems="center">
            <Box
              width={100}
              height={100}
              bg="blue.600"
              borderRadius="full"
              alignItems="center"
              justifyContent="center"
            >
              <Text fontSize="3xl" color="white" fontWeight="bold">
                🥩
              </Text>
            </Box>
            <VStack space={2} alignItems="center">
              <Text fontSize="2xl" fontWeight="bold" color="gray.800">
                Registro de Pesos
              </Text>
              <Text fontSize="md" color="gray.600" textAlign="center">
                Aplicación para recepción de carnes
              </Text>
            </VStack>
          </VStack>

          {/* Authentication Section */}
          <VStack flex={2} space={6} justifyContent="center">
            {loadingUsers ? (
              <LoadingState
                message="Cargando usuarios..."
                size="large"
              />
            ) : error ? (
              <ErrorState
                message={error}
                onRetry={handleRetry}
                testID="login-error"
              />
            ) : (
              <UserSelector
                users={users}
                onUserSelect={handleUserSelect}
                loading={isLoading}
                testID="user-selector"
              />
            )}
          </VStack>

          {/* Footer */}
          <VStack space={2} alignItems="center">
            <Text fontSize="sm" color="gray.500" textAlign="center">
              Versión 1.0.0
            </Text>
            <Text fontSize="xs" color="gray.400" textAlign="center">
              Optimizado para uso industrial
            </Text>
          </VStack>
        </VStack>
      </Box>
    </SafeAreaView>
  );
};