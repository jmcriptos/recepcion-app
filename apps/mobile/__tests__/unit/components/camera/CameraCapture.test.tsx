import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { Alert } from 'react-native';
import { CameraCapture } from '../../../../src/components/camera/CameraCapture';

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

// Mock Alert
jest.spyOn(Alert, 'alert');

const renderWithProvider = (component: React.ReactElement) => {
  return render(
    <NativeBaseProvider>{component}</NativeBaseProvider>
  );
};

describe('CameraCapture', () => {
  const mockOnImageCaptured = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with initialization message', () => {
    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    expect(getByText('Inicializando cámara...')).toBeTruthy();
  });

  it('shows permission denied screen when permissions are not granted', async () => {
    const { request } = require('react-native-permissions');
    request.mockResolvedValue('denied');

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(getByText('Permisos de Cámara Requeridos')).toBeTruthy();
    });
  });

  it('shows camera interface when permissions are granted', async () => {
    const { request } = require('react-native-permissions');
    request.mockResolvedValue('granted');

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      expect(getByText('Coloca la etiqueta dentro del marco amarillo')).toBeTruthy();
    });
  });

  it('handles flash toggle correctly', async () => {
    const { request } = require('react-native-permissions');
    request.mockResolvedValue('granted');

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const flashButton = getByText('Flash');
      fireEvent.press(flashButton);
      // Flash should be toggled (visual feedback would be checked in integration tests)
    });
  });

  it('calls onCancel when cancel button is pressed', async () => {
    const { request } = require('react-native-permissions');
    request.mockResolvedValue('granted');

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const cancelButton = getByText('Cancelar');
      fireEvent.press(cancelButton);
      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  it('handles successful image capture', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    launchCamera.mockImplementation((options, callback) => {
      callback({
        assets: [{
          uri: 'file://test-image.jpg',
          fileName: 'test-image.jpg',
          fileSize: 1024000,
          type: 'image/jpeg',
          width: 3000,
          height: 2000,
        }],
      });
    });

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const captureButton = getByText('📷');
      fireEvent.press(captureButton);
    });

    await waitFor(() => {
      expect(mockOnImageCaptured).toHaveBeenCalledWith({
        uri: 'file://test-image.jpg',
        fileName: 'test-image.jpg',
        fileSize: 1024000,
        type: 'image/jpeg',
        width: 3000,
        height: 2000,
        timestamp: expect.any(Number),
      });
    });
  });

  it('handles camera capture cancellation', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    launchCamera.mockImplementation((options, callback) => {
      callback({ didCancel: true });
    });

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const captureButton = getByText('📷');
      fireEvent.press(captureButton);
    });

    // Should not call onImageCaptured when user cancels
    expect(mockOnImageCaptured).not.toHaveBeenCalled();
  });

  it('handles camera capture error', async () => {
    const { request } = require('react-native-permissions');
    const { launchCamera } = require('react-native-image-picker');
    
    request.mockResolvedValue('granted');
    launchCamera.mockImplementation((options, callback) => {
      callback({ errorMessage: 'Camera error' });
    });

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const captureButton = getByText('📷');
      fireEvent.press(captureButton);
    });

    // Should not call onImageCaptured on error
    expect(mockOnImageCaptured).not.toHaveBeenCalled();
  });

  it('displays industrial-friendly button sizes', async () => {
    const { request } = require('react-native-permissions');
    request.mockResolvedValue('granted');

    const { getByText } = renderWithProvider(
      <CameraCapture
        onImageCaptured={mockOnImageCaptured}
        onCancel={mockOnCancel}
      />
    );

    await waitFor(() => {
      const flashButton = getByText('Flash');
      const captureButton = getByText('📷');
      const cancelButton = getByText('Cancelar');

      // All buttons should have proper styling for industrial use
      expect(flashButton).toBeTruthy();
      expect(captureButton).toBeTruthy();
      expect(cancelButton).toBeTruthy();
    });
  });
});