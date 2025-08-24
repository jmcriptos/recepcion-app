/**
 * Loading State Component
 * Displays loading spinner with message for industrial environments
 */

import React from 'react';
import { VStack, Spinner, Text } from 'native-base';
import { LoadingStateProps } from '../../types/components';

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Cargando...',
  size = 'large',
}) => {
  const getSpinnerSize = () => {
    return size === 'large' ? 'lg' : 'sm';
  };

  return (
    <VStack space={4} alignItems="center" justifyContent="center" py={8}>
      <Spinner size={getSpinnerSize()} color="blue.600" />
      <Text fontSize="md" color="gray.600" textAlign="center">
        {message}
      </Text>
    </VStack>
  );
};