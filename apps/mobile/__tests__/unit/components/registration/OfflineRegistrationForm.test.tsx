/**
 * @jest-environment jsdom
 */
import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import { OfflineRegistrationForm } from '../../../../src/components/registration/OfflineRegistrationForm';
import { useRegistrationStore } from '../../../../src/stores/registration-store';
import { useIsOnline } from '../../../../src/stores/offline-store';

// Mock the stores
jest.mock('../../../../src/stores/registration-store');
jest.mock('../../../../src/stores/offline-store');
jest.mock('../../../../src/services/ocr-service');

const mockUseRegistrationStore = useRegistrationStore as jest.MockedFunction<typeof useRegistrationStore>;
const mockUseIsOnline = useIsOnline as jest.MockedFunction<typeof useIsOnline>;

const mockStore = {
  setFormData: jest.fn(),
  setCapturedImage: jest.fn(),
  setCurrentOcrResult: jest.fn(),
  submitRegistration: jest.fn(),
  resetForm: jest.fn(),
  clearErrors: jest.fn(),
};

const mockFormData = {
  weight: '',
  cut_type: '' as const,
  supplier: '',
};

const mockFormErrors = {};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <NativeBaseProvider>{children}</NativeBaseProvider>
);

describe('OfflineRegistrationForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock store return values
    mockUseRegistrationStore.mockReturnValue(mockStore);
    mockUseIsOnline.mockReturnValue(true);
    
    // Mock individual selectors
    (useRegistrationStore as any).mockImplementation((selector: any) => {
      if (selector.toString().includes('formData')) return mockFormData;
      if (selector.toString().includes('errors')) return mockFormErrors;
      if (selector.toString().includes('isSubmitting')) return false;
      if (selector.toString().includes('capturedImage')) return null;
      if (selector.toString().includes('currentOcrResult')) return null;
      return undefined;
    });
  });

  it('renders form fields correctly', () => {
    const { getByPlaceholderText, getByText } = render(
      <OfflineRegistrationForm />,
      { wrapper: Wrapper }
    );

    expect(getByPlaceholderText('Ej: 25.5')).toBeTruthy();
    expect(getByPlaceholderText('Nombre del proveedor')).toBeTruthy();
    expect(getByText('Tipo de Corte')).toBeTruthy();
    expect(getByText('Guardar Registro')).toBeTruthy();
  });

  it('shows offline indicator when offline', () => {
    mockUseIsOnline.mockReturnValue(false);
    
    const { getByText } = render(
      <OfflineRegistrationForm />,
      { wrapper: Wrapper }
    );

    expect(getByText('Modo Offline - Los datos se guardarán localmente')).toBeTruthy();
  });

  it('calls setFormData when weight input changes', () => {
    const { getByPlaceholderText } = render(
      <OfflineRegistrationForm />,
      { wrapper: Wrapper }
    );

    const weightInput = getByPlaceholderText('Ej: 25.5');
    fireEvent.changeText(weightInput, '25.5');

    expect(mockStore.setFormData).toHaveBeenCalledWith({ weight: '25.5' });
  });

  it('calls setFormData when supplier input changes', () => {
    const { getByPlaceholderText } = render(
      <OfflineRegistrationForm />,
      { wrapper: Wrapper }
    );

    const supplierInput = getByPlaceholderText('Nombre del proveedor');
    fireEvent.changeText(supplierInput, 'Test Supplier');

    expect(mockStore.setFormData).toHaveBeenCalledWith({ supplier: 'Test Supplier' });
  });

  it('opens confirmation dialog when save button is pressed', () => {
    const { getByText } = render(
      <OfflineRegistrationForm />,
      { wrapper: Wrapper }
    );

    const saveButton = getByText('Guardar Registro');
    fireEvent.press(saveButton);

    expect(mockStore.clearErrors).toHaveBeenCalled();
    expect(getByText('Confirmar Registro')).toBeTruthy();
  });

  it('handles successful registration submission', async () => {
    const mockOnSuccess = jest.fn();
    const mockRegistration = { id: 'test-id' };
    
    mockStore.submitRegistration.mockResolvedValue(mockRegistration);
    
    const { getByText } = render(
      <OfflineRegistrationForm onSuccess={mockOnSuccess} />,
      { wrapper: Wrapper }
    );

    // Open confirmation dialog
    const saveButton = getByText('Guardar Registro');
    fireEvent.press(saveButton);

    // Confirm submission
    const confirmButton = getByText('Confirmar');
    fireEvent.press(confirmButton);

    await waitFor(() => {
      expect(mockStore.submitRegistration).toHaveBeenCalledWith('current_user');
      expect(mockOnSuccess).toHaveBeenCalledWith('test-id');
    });
  });

  it('displays captured image when provided', () => {
    const mockImage = { uri: 'test://image.jpg' };
    
    const { getByText } = render(
      <OfflineRegistrationForm capturedImage={mockImage} />,
      { wrapper: Wrapper }
    );

    expect(getByText('Foto Capturada')).toBeTruthy();
    expect(mockStore.setCapturedImage).toHaveBeenCalledWith(mockImage);
  });

  it('calls onCancel when cancel button is pressed', () => {
    const mockOnCancel = jest.fn();
    
    const { getByText } = render(
      <OfflineRegistrationForm onCancel={mockOnCancel} />,
      { wrapper: Wrapper }
    );

    const cancelButton = getByText('Cancelar');
    fireEvent.press(cancelButton);

    expect(mockOnCancel).toHaveBeenCalled();
  });
});