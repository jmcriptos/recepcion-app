/**
 * User Selector Component
 * Displays available users for quick selection with large touch targets
 */

import React from 'react';
import { VStack, HStack, Text, ScrollView, Box, Badge } from 'native-base';
import { IndustrialButton } from '../industrial/IndustrialButton';
import { UserSelectorProps } from '../../types/components';

export const UserSelector: React.FC<UserSelectorProps> = ({
  users,
  onUserSelect,
  loading = false,
  error = null,
  testID,
}) => {
  const getRoleBadgeColor = (role: 'operator' | 'supervisor') => {
    return role === 'supervisor' ? 'orange' : 'blue';
  };

  const getRoleDisplayName = (role: 'operator' | 'supervisor') => {
    return role === 'supervisor' ? 'Supervisor' : 'Operador';
  };

  if (error) {
    return (
      <Box
        bg="red.50"
        p={4}
        borderRadius="md"
        borderWidth={1}
        borderColor="red.200"
        testID={`${testID}-error`}
      >
        <Text color="red.600" fontSize="md" textAlign="center">
          {error}
        </Text>
      </Box>
    );
  }

  return (
    <VStack space={4} testID={testID}>
      <Text fontSize="xl" fontWeight="bold" textAlign="center" color="gray.700">
        Selecciona tu nombre
      </Text>
      
      <ScrollView
        maxHeight="400px"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        <VStack space={3}>
          {users.map((user) => (
            <Box key={user.id} testID={`user-item-${user.id}`}>
              <IndustrialButton
                title={user.name}
                onPress={() => onUserSelect(user.name)}
                variant="outline"
                size="large"
                disabled={loading}
                testID={`user-button-${user.id}`}
              />
              <HStack justifyContent="center" mt={1}>
                <Badge
                  colorScheme={getRoleBadgeColor(user.role)}
                  variant="solid"
                  rounded="md"
                >
                  <Text fontSize="xs" color="white" fontWeight="medium">
                    {getRoleDisplayName(user.role)}
                  </Text>
                </Badge>
              </HStack>
            </Box>
          ))}
        </VStack>
      </ScrollView>

      {users.length === 0 && !loading && (
        <Box
          bg="gray.50"
          p={6}
          borderRadius="md"
          borderWidth={1}
          borderColor="gray.200"
        >
          <Text color="gray.500" fontSize="md" textAlign="center">
            No hay usuarios disponibles
          </Text>
        </Box>
      )}
    </VStack>
  );
};