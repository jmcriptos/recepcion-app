/**
 * Error State Component
 * Displays error messages with retry functionality
 */

import React from 'react';
import { VStack, Text, Box } from 'native-base';
import { IndustrialButton } from '../industrial/IndustrialButton';
import { ErrorStateProps } from '../../types/components';

export const ErrorState: React.FC<ErrorStateProps> = ({
  message,
  onRetry,
  testID,
}) => {
  return (
    <VStack space={4} alignItems="center" py={8} testID={testID}>
      <Box
        bg="red.50"
        p={6}
        borderRadius="md"
        borderWidth={1}
        borderColor="red.200"
        width="100%"
      >
        <Text
          fontSize="md"
          color="red.600"
          textAlign="center"
          fontWeight="medium"
        >
          {message}
        </Text>
      </Box>
      
      {onRetry && (
        <IndustrialButton
          title="Intentar de nuevo"
          onPress={onRetry}
          variant="primary"
          size="large"
          testID={`${testID}-retry-button`}
        />
      )}
    </VStack>
  );
};