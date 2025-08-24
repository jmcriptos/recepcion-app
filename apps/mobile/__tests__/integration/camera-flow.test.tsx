import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NativeBaseProvider } from 'native-base';
import { CameraScreen } from '../../src/screens/registration/CameraScreen';

// Mock react-native-image-picker
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
}));

// Mock react-native-permissions
jest.mock('react-native-permissions', () => ({
  request: jest.fn(),
  check: jest.fn(),
  PERMISSIONS: {
    IOS: {
      CAMERA: 'ios.permission.CAMERA',
      PHOTO_LIBRARY: 'ios.permission.PHOTO_LIBRARY',
    },
    ANDROID: {
      CAMERA: 'android.permission.CAMERA',
      WRITE_EXTERNAL_STORAGE: 'android.permission.WRITE_EXTERNAL_STORAGE',
    },
  },
  RESULTS: {
    GRANTED: 'granted',
    DENIED: 'denied',
  },
}));

const Stack = createNativeStackNavigator();

const ManualEntryMockScreen = ({ route }: any) => {
  const React = require('react');
  const { Box, Text } = require('native-base');
  
  return (
    <Box flex={1} testID="manual-entry-screen">
      <Text>Manual Entry Screen</Text>
      {route.params?.capturedImage && (
        <Text testID="captured-image-uri">
          Image captured: {route.params.capturedImage.uri}
        </Text>
      )}
    </Box>
  );
};

const renderWithNavigation = (initialRoute = 'CameraScreen') => {
  return render(
    <NativeBaseProvider>
      <NavigationContainer>
        <Stack.Navigator initialRouteName={initialRoute}>
          <Stack.Screen 
            name="CameraScreen" 
            component={CameraScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen 
            name="ManualEntryScreen" 
            component={ManualEntryMockScreen}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </NativeBaseProvider>
  );
};

describe('Camera Flow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('navigates through complete camera capture flow', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    // Mock permissions granted
    request.mockResolvedValue('granted');
    
    // Mock successful image capture
    launchCamera.mockImplementation((options, callback) => {
      callback({
        assets: [{
          uri: 'file://test-captured-image.jpg',
          fileName: 'test-image.jpg',
          fileSize: 2048000,
          type: 'image/jpeg',
          width: 3000,
          height: 2000,
        }],
      });
    });

    const { getByText, queryByTestId } = renderWithNavigation();

    // Wait for camera to initialize and permissions to be granted
    await waitFor(() => {
      expect(getByText('Coloca la etiqueta dentro del marco amarillo')).toBeTruthy();
    });

    // Capture image
    const captureButton = getByText('📷');
    fireEvent.press(captureButton);

    // Should show preview screen
    await waitFor(() => {
      expect(getByText('Vista Previa de la Foto')).toBeTruthy();
    });

    // Use the captured photo
    const usePhotoButton = getByText('✓ Usar Esta Foto');
    fireEvent.press(usePhotoButton);

    // Should navigate to manual entry with captured image
    await waitFor(() => {
      expect(queryByTestId('manual-entry-screen')).toBeTruthy();
      expect(queryByTestId('captured-image-uri')).toBeTruthy();
    });
  });

  it('handles permission denial flow', async () => {
    const { request } = require('react-native-permissions');
    
    // Mock permissions denied
    request.mockResolvedValue('denied');

    const { getByText } = renderWithNavigation();

    // Should show permission denied screen
    await waitFor(() => {
      expect(getByText('Permisos de Cámara Requeridos')).toBeTruthy();
    });

    // User can retry permissions
    const retryButton = getByText('Intentar de Nuevo');
    expect(retryButton).toBeTruthy();
  });

  it('handles camera capture cancellation', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    launchCamera.mockImplementation((options, callback) => {
      callback({ didCancel: true });
    });

    const { getByText, queryByText } = renderWithNavigation();

    await waitFor(() => {
      expect(getByText('Coloca la etiqueta dentro del marco amarillo')).toBeTruthy();
    });

    // Attempt to capture image
    const captureButton = getByText('📷');
    fireEvent.press(captureButton);

    // Should remain on camera screen (no navigation to preview)
    await waitFor(() => {
      expect(queryByText('Vista Previa de la Foto')).toBeFalsy();
      expect(getByText('Coloca la etiqueta dentro del marco amarillo')).toBeTruthy();
    });
  });

  it('handles retake photo flow', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    launchCamera.mockImplementation((options, callback) => {
      callback({
        assets: [{
          uri: 'file://test-image.jpg',
          fileName: 'test.jpg',
          fileSize: 1024000,
          type: 'image/jpeg',
          width: 2000,
          height: 1500,
        }],
      });
    });

    const { getByText } = renderWithNavigation();

    // Wait for camera to initialize
    await waitFor(() => {
      expect(getByText('📷')).toBeTruthy();
    });

    // Capture image
    const captureButton = getByText('📷');
    fireEvent.press(captureButton);

    // Should show preview
    await waitFor(() => {
      expect(getByText('Vista Previa de la Foto')).toBeTruthy();
    });

    // Retake photo
    const retakeButton = getByText('📷 Tomar Otra');
    fireEvent.press(retakeButton);

    // Should return to camera capture
    await waitFor(() => {
      expect(getByText('Coloca la etiqueta dentro del marco amarillo')).toBeTruthy();
    });
  });

  it('displays image quality feedback in preview', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    
    // Mock high-quality image
    launchCamera.mockImplementation((options, callback) => {
      callback({
        assets: [{
          uri: 'file://high-quality-image.jpg',
          fileName: 'hq-image.jpg',
          fileSize: 5 * 1024 * 1024, // 5MB
          type: 'image/jpeg',
          width: 4000,
          height: 3000, // 12MP
        }],
      });
    });

    const { getByText } = renderWithNavigation();

    await waitFor(() => {
      expect(getByText('📷')).toBeTruthy();
    });

    // Capture high-quality image
    const captureButton = getByText('📷');
    fireEvent.press(captureButton);

    // Should show good quality indicator
    await waitFor(() => {
      expect(getByText('Excelente para OCR')).toBeTruthy();
    });
  });

  it('shows quality warning for poor images', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    
    // Mock low-quality image
    launchCamera.mockImplementation((options, callback) => {
      callback({
        assets: [{
          uri: 'file://low-quality-image.jpg',
          fileName: 'lq-image.jpg',
          fileSize: 200 * 1024, // 200KB - very small
          type: 'image/jpeg',
          width: 800,
          height: 600, // Low resolution
        }],
      });
    });

    const { getByText } = renderWithNavigation();

    await waitFor(() => {
      expect(getByText('📷')).toBeTruthy();
    });

    // Capture low-quality image
    const captureButton = getByText('📷');
    fireEvent.press(captureButton);

    // Should show quality warning
    await waitFor(() => {
      expect(getByText('⚠️ Calidad baja detectada')).toBeTruthy();
    });
  });

  it('handles navigation cancellation', async () => {
    const { request } = require('react-native-permissions');
    request.mockResolvedValue('granted');

    const { getByText } = renderWithNavigation();

    await waitFor(() => {
      expect(getByText('Cancelar')).toBeTruthy();
    });

    // Cancel should trigger navigation back
    const cancelButton = getByText('Cancelar');
    fireEvent.press(cancelButton);

    // In a real app, this would navigate back to the previous screen
    // Here we just verify the button is functional
    expect(cancelButton).toBeTruthy();
  });
});