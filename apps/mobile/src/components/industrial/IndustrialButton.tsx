/**
 * Industrial Button Component
 * Optimized for glove operation with minimum 60px touch targets
 * High contrast design for industrial environments
 */

import React from 'react';
import { Button, Text, Spinner } from 'native-base';
import { IndustrialButtonProps } from '../../types/components';

export const IndustrialButton: React.FC<IndustrialButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  disabled = false,
  loading = false,
  icon,
  testID,
}) => {
  const getButtonHeight = () => {
    switch (size) {
      case 'xlarge':
        return 80; // Extra large for critical actions
      case 'large':
      default:
        return 60; // Minimum requirement for glove operation
    }
  };

  const getButtonColors = () => {
    switch (variant) {
      case 'primary':
        return {
          bg: disabled ? 'gray.300' : 'blue.600',
          _pressed: { bg: 'blue.700' },
          _text: { color: 'white' },
        };
      case 'secondary':
        return {
          bg: disabled ? 'gray.200' : 'gray.100',
          _pressed: { bg: 'gray.200' },
          _text: { color: disabled ? 'gray.400' : 'gray.700' },
        };
      case 'outline':
        return {
          bg: 'transparent',
          borderWidth: 2,
          borderColor: disabled ? 'gray.300' : 'blue.600',
          _pressed: { bg: 'blue.50' },
          _text: { color: disabled ? 'gray.400' : 'blue.600' },
        };
      default:
        return {
          bg: 'blue.600',
          _pressed: { bg: 'blue.700' },
          _text: { color: 'white' },
        };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'xlarge':
        return 'xl'; // Extra large text for visibility
      case 'large':
      default:
        return 'lg'; // Large text for industrial visibility
    }
  };

  return (
    <Button
      onPress={onPress}
      isDisabled={disabled || loading}
      height={getButtonHeight()}
      minWidth="200px"
      borderRadius="12"
      shadow={disabled ? 'none' : '3'}
      testID={testID}
      {...getButtonColors()}
    >
      {loading ? (
        <Spinner color="white" size="sm" />
      ) : (
        <Text
          fontSize={getFontSize()}
          fontWeight="bold"
          textAlign="center"
          numberOfLines={2}
          {...getButtonColors()._text}
        >
          {title}
        </Text>
      )}
    </Button>
  );
};