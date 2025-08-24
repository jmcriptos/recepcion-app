/**
 * Offline Registration Flow Integration Tests
 * Tests the complete offline registration workflow with photo capture, OCR, and sync
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { NavigationContainer } from '@react-navigation/native';
import { RegistrationNavigator } from '../../src/navigation/RegistrationNavigator';
import { useOfflineStore } from '../../src/stores/offline-store';
import { useRegistrationStore } from '../../src/stores/registration-store';
import OCRService from '../../src/services/ocr-service';
import PhotoStorageService from '../../src/services/photo-storage-service';

// Mock dependencies
jest.mock('../../src/services/ocr-service');
jest.mock('../../src/services/photo-storage-service');
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
}));

const MockedOCRService = OCRService as jest.MockedClass<typeof OCRService>;
const MockedPhotoStorageService = PhotoStorageService as jest.MockedClass<typeof PhotoStorageService>;

// Mock navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
}));

// Test wrapper component
const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider>
    <NavigationContainer>
      {children}
    </NavigationContainer>
  </NativeBaseProvider>
);

describe('Offline Registration Flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset stores
    useOfflineStore.getState().reset?.();
    useRegistrationStore.getState().clearCurrent();
    
    // Setup mock services
    MockedOCRService.prototype.processImage = jest.fn().mockResolvedValue({
      text: '25.5 kg',
      confidence: 0.85,
      processing_type: 'local' as const,
      needs_server_processing: false,
      processing_time: 1500,
    });
    
    MockedPhotoStorageService.prototype.storePhoto = jest.fn().mockResolvedValue({
      id: 'photo_123',
      originalPath: '/path/to/original.jpg',
      compressedPath: '/path/to/compressed.jpg',
      originalSize: 2048000,
      compressedSize: 512000,
      compressionRatio: 0.75,
      uploadStatus: 'pending' as const,
      createdAt: new Date().toISOString(),
    });
  });

  it('should complete offline registration workflow with photo and OCR', async () => {
    const { getByText, getByTestId, getByPlaceholderText } = render(
      <TestWrapper>
        <RegistrationNavigator />
      </TestWrapper>
    );

    // 1. Start from registration home screen
    expect(getByText('Registro de Pesos')).toBeTruthy();
    expect(getByText('📷 Capturar con Cámara')).toBeTruthy();

    // 2. Navigate to camera screen
    fireEvent.press(getByText('📷 Capturar con Cámara'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('CameraScreen');
    });

    // 3. Navigate directly to manual entry with captured image
    fireEvent.press(getByText('✏️ Entrada Manual'));
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('ManualEntryScreen');
    });

    // 4. Mock image capture completion
    const mockCapturedImage = {
      uri: 'file:///path/to/captured/image.jpg',
      width: 1920,
      height: 1080,
      fileSize: 1024000,
      timestamp: Date.now(),
    };

    // Simulate navigation with captured image
    const registrationFormProps = {
      capturedImage: mockCapturedImage,
      onSuccess: jest.fn(),
      onCancel: jest.fn(),
    };

    // 5. Wait for OCR processing to complete
    await waitFor(() => {
      expect(MockedOCRService.prototype.processImage).toHaveBeenCalledWith(
        mockCapturedImage.uri,
        expect.objectContaining({
          confidenceThreshold: 0.6,
          allowFallback: expect.any(Boolean),
        })
      );
    }, { timeout: 5000 });

    // 6. Verify weight field is auto-filled
    const weightInput = getByPlaceholderText('Ej: 25.5');
    await waitFor(() => {
      expect(weightInput.props.value).toBe('25.5');
    });

    // 7. Fill supplier field
    const supplierInput = getByPlaceholderText('Nombre del proveedor');
    fireEvent.changeText(supplierInput, 'Proveedor Test');

    // 8. Select cut type
    const cutTypeSelect = getByTestId('cut-type-select');
    fireEvent(cutTypeSelect, 'onValueChange', 'jamón');

    // 9. Submit registration
    const submitButton = getByText('Guardar Registro');
    fireEvent.press(submitButton);

    // 10. Confirm in dialog
    await waitFor(() => {
      expect(getByText('Confirmar Registro')).toBeTruthy();
    });

    const confirmButton = getByText('Confirmar');
    fireEvent.press(confirmButton);

    // 11. Verify registration is created and stored locally
    await waitFor(() => {
      const registrationStore = useRegistrationStore.getState();
      expect(registrationStore.recentRegistrations).toHaveLength(1);
      
      const registration = registrationStore.recentRegistrations[0];
      expect(registration.weight).toBe(25.5);
      expect(registration.cut_type).toBe('jamón');
      expect(registration.supplier).toBe('Proveedor Test');
      expect(registration.sync_status).toBe('pending');
    });

    // 12. Verify photo storage
    expect(MockedPhotoStorageService.prototype.storePhoto).toHaveBeenCalledWith(
      mockCapturedImage.uri,
      expect.stringMatching(/registration_\d+/)
    );

    // 13. Verify navigation to confirmation screen
    expect(mockNavigate).toHaveBeenCalledWith('ConfirmationScreen', {
      registrationId: expect.any(String),
    });
  });

  it('should handle offline mode gracefully', async () => {
    // Set offline mode
    act(() => {
      useOfflineStore.getState().setNetworkStatus({
        isConnected: false,
        type: 'none',
        isInternetReachable: false,
      });
    });

    const { getByText, getByTestId } = render(
      <TestWrapper>
        <RegistrationNavigator />
      </TestWrapper>
    );

    // Verify offline indicator is shown
    expect(getByText('📡 Offline')).toBeTruthy();
    expect(getByText('Modo Offline - Los datos se guardarán localmente')).toBeTruthy();

    // Verify sync status shows pending items
    const syncStatusCounter = getByTestId('sync-status-counter');
    fireEvent.press(syncStatusCounter);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('SyncStatusScreen');
    });
  });

  it('should handle OCR processing failures gracefully', async () => {
    // Mock OCR failure
    MockedOCRService.prototype.processImage = jest.fn().mockResolvedValue({
      text: '',
      confidence: 0,
      processing_type: 'manual' as const,
      needs_server_processing: true,
      processing_time: 3000,
      error: 'OCR confidence below threshold, manual input required',
    });

    const { getByText, getByPlaceholderText } = render(
      <TestWrapper>
        <RegistrationNavigator />
      </TestWrapper>
    );

    // Navigate to manual entry
    fireEvent.press(getByText('✏️ Entrada Manual'));

    // Simulate image with poor OCR quality
    const mockCapturedImage = {
      uri: 'file:///path/to/poor_quality_image.jpg',
      width: 800,
      height: 600,
      fileSize: 256000,
      timestamp: Date.now(),
    };

    // Wait for OCR processing
    await waitFor(() => {
      expect(MockedOCRService.prototype.processImage).toHaveBeenCalled();
    });

    // Verify weight field is NOT auto-filled
    const weightInput = getByPlaceholderText('Ej: 25.5');
    expect(weightInput.props.value).toBe('');

    // Verify manual input is required
    expect(getByText('OCR requiere entrada manual')).toBeTruthy();

    // Manual entry should still work
    fireEvent.changeText(weightInput, '15.2');
    fireEvent.changeText(getByPlaceholderText('Nombre del proveedor'), 'Manual Supplier');

    const submitButton = getByText('Guardar Registro');
    fireEvent.press(submitButton);

    // Should still create registration with manual data
    const confirmButton = getByText('Confirmar');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      const registrationStore = useRegistrationStore.getState();
      const registration = registrationStore.recentRegistrations[0];
      expect(registration.weight).toBe(15.2);
      expect(registration.supplier).toBe('Manual Supplier');
    });
  });

  it('should validate form inputs correctly', async () => {
    const { getByText, getByPlaceholderText } = render(
      <TestWrapper>
        <RegistrationNavigator />
      </TestWrapper>
    );

    // Navigate to manual entry
    fireEvent.press(getByText('✏️ Entrada Manual'));

    // Try to submit without required fields
    const submitButton = getByText('Guardar Registro');
    fireEvent.press(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(getByText('Peso es requerido')).toBeTruthy();
      expect(getByText('Proveedor es requerido')).toBeTruthy();
    });

    // Invalid weight values
    const weightInput = getByPlaceholderText('Ej: 25.5');
    fireEvent.changeText(weightInput, '0.05'); // Below minimum
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(getByText(/Peso debe estar entre/)).toBeTruthy();
    });

    fireEvent.changeText(weightInput, '55'); // Above maximum
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(getByText(/Peso debe estar entre/)).toBeTruthy();
    });

    // Invalid supplier length
    const supplierInput = getByPlaceholderText('Nombre del proveedor');
    fireEvent.changeText(supplierInput, 'a'.repeat(101)); // Too long
    fireEvent.press(submitButton);

    await waitFor(() => {
      expect(getByText('Proveedor debe tener máximo 100 caracteres')).toBeTruthy();
    });

    // Valid inputs should clear errors
    fireEvent.changeText(weightInput, '20.5');
    fireEvent.changeText(supplierInput, 'Valid Supplier');
    fireEvent.press(submitButton);

    // Should proceed to confirmation
    await waitFor(() => {
      expect(getByText('Confirmar Registro')).toBeTruthy();
    });
  });
});