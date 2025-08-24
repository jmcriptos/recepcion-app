/**
 * Registration Store
 * Zustand store for offline registration workflow state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LocalWeightRegistration, CreateRegistrationPayload, OCRResult } from '../types/offline';
import { CapturedImage } from '../types/camera';
import RegistrationStorageService from '../services/registration-storage';
import SyncQueueService from '../services/sync-queue-service';
import { useOfflineStore } from './offline-store';

interface RegistrationFormData {
  weight: string;
  cut_type: 'jamón' | 'chuleta' | '';
  supplier: string;
}

interface RegistrationState {
  // Form state
  formData: RegistrationFormData;
  isSubmitting: boolean;
  errors: Record<string, string>;
  
  // Image handling
  capturedImage: CapturedImage | null;
  
  // OCR state
  currentOcrResult: OCRResult | null;
  
  // Recent registrations cache
  recentRegistrations: LocalWeightRegistration[];
  isLoadingRecent: boolean;
  
  // UI state
  showOfflineIndicator: boolean;
  
  // Actions
  setFormData: (data: Partial<RegistrationFormData>) => void;
  setFieldError: (field: string, error: string | null) => void;
  clearErrors: () => void;
  setCapturedImage: (image: CapturedImage | null) => void;
  setCurrentOcrResult: (result: OCRResult | null) => void;
  
  // Registration operations
  submitRegistration: (registeredBy: string) => Promise<LocalWeightRegistration>;
  loadRecentRegistrations: () => Promise<void>;
  resetForm: () => void;
  
  // UI actions
  setOfflineIndicator: (show: boolean) => void;
}

const initialFormData: RegistrationFormData = {
  weight: '',
  cut_type: '',
  supplier: '',
};

export const useRegistrationStore = create<RegistrationState>()(
  persist(
    (set, get) => ({
      // Initial state
      formData: initialFormData,
      isSubmitting: false,
      errors: {},
      capturedImage: null,
      currentOcrResult: null,
      recentRegistrations: [],
      isLoadingRecent: false,
      showOfflineIndicator: false,

      // Form actions
      setFormData: (data: Partial<RegistrationFormData>) => {
        set(state => ({
          formData: { ...state.formData, ...data },
          errors: { ...state.errors, ...Object.keys(data).reduce((acc, key) => ({
            ...acc,
            [key]: null
          }), {}) }
        }));
      },

      setFieldError: (field: string, error: string | null) => {
        set(state => ({
          errors: error ? { ...state.errors, [field]: error } : 
                         Object.fromEntries(Object.entries(state.errors).filter(([k]) => k !== field))
        }));
      },

      clearErrors: () => {
        set({ errors: {} });
      },

      setCapturedImage: (image: CapturedImage | null) => {
        set({ capturedImage: image });
      },

      setCurrentOcrResult: (result: OCRResult | null) => {
        set({ currentOcrResult: result });
        
        // Auto-fill form if OCR result has weight and high confidence
        if (result && result.confidence > 0.7) {
          const weightMatch = result.text.match(/(\d+\.?\d*)\s*kg/i);
          if (weightMatch) {
            get().setFormData({ weight: weightMatch[1] });
          }
        }
      },

      // Registration operations
      submitRegistration: async (registeredBy: string): Promise<LocalWeightRegistration> => {
        const state = get();
        set({ isSubmitting: true, errors: {} });

        try {
          // Validate form data
          const validationErrors = validateFormData(state.formData);
          if (Object.keys(validationErrors).length > 0) {
            set({ errors: validationErrors, isSubmitting: false });
            throw new Error('Form validation failed');
          }

          // Prepare payload
          const payload: CreateRegistrationPayload = {
            weight: parseFloat(state.formData.weight),
            cut_type: state.formData.cut_type as 'jamón' | 'chuleta',
            supplier: state.formData.supplier.trim(),
            local_photo_path: state.capturedImage?.uri,
            registered_by: registeredBy,
          };

          const registrationService = RegistrationStorageService.getInstance();
          const syncQueueService = SyncQueueService.getInstance();

          // Always save locally first for offline-first approach
          const registration = await registrationService.createRegistration(payload);
          
          // Update OCR confidence if available
          if (state.currentOcrResult && state.currentOcrResult.confidence) {
            await registrationService.updateOcrConfidence(registration.id, state.currentOcrResult.confidence);
          }

          // Queue for sync when network is available
          await syncQueueService.queueRegistrationCreation(payload, registration.id);
          
          // Reset form and reload recent registrations
          get().resetForm();
          await get().loadRecentRegistrations();

          set({ isSubmitting: false });
          console.log('✅ Registration submitted successfully:', registration.id);
          
          return registration;
        } catch (error) {
          set({ isSubmitting: false });
          console.error('❌ Registration submission failed:', error);
          throw error;
        }
      },

      loadRecentRegistrations: async () => {
        set({ isLoadingRecent: true });
        
        try {
          const registrationService = RegistrationStorageService.getInstance();
          const registrations = await registrationService.getRegistrations({
            limit: 10,
            offset: 0,
          });
          
          set({ 
            recentRegistrations: registrations,
            isLoadingRecent: false 
          });
        } catch (error) {
          console.error('❌ Failed to load recent registrations:', error);
          set({ isLoadingRecent: false });
        }
      },

      resetForm: () => {
        set({
          formData: initialFormData,
          errors: {},
          capturedImage: null,
          currentOcrResult: null,
        });
      },

      // UI actions

      setOfflineIndicator: (show) => {
        set({ showOfflineIndicator: show });
      },
    }),
    {
      name: 'registration-store',
      storage: {
        getItem: async (name) => {
          const value = await AsyncStorage.getItem(name);
          return value ? JSON.parse(value) : null;
        },
        setItem: async (name, value) => {
          await AsyncStorage.setItem(name, JSON.stringify(value));
        },
        removeItem: async (name) => {
          await AsyncStorage.removeItem(name);
        },
      },
      // Only persist form data and non-sensitive state
      // @ts-ignore - zustand persist partialize has typing issues
      partialize: (state) => ({
        formData: state.formData,
        recentRegistrations: state.recentRegistrations.slice(0, 5), // Only persist last 5
      }),
    }
  )
);

/**
 * Validate registration form data
 */
function validateFormData(data: RegistrationFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // Weight validation
  if (!data.weight || data.weight.trim() === '') {
    errors.weight = 'Weight is required';
  } else {
    const weight = parseFloat(data.weight);
    if (isNaN(weight) || weight <= 0) {
      errors.weight = 'Weight must be a valid number greater than 0';
    } else if (weight < 0.1 || weight > 50) {
      errors.weight = 'Weight must be between 0.1 and 50 kg';
    } else if (!/^\d+(\.\d{1,2})?$/.test(data.weight)) {
      errors.weight = 'Weight can have maximum 2 decimal places';
    }
  }

  // Cut type validation
  if (!data.cut_type) {
    errors.cut_type = 'Cut type is required';
  } else if (data.cut_type !== 'jamón' && data.cut_type !== 'chuleta') {
    errors.cut_type = 'Cut type must be either jamón or chuleta';
  }

  // Supplier validation
  if (!data.supplier || data.supplier.trim() === '') {
    errors.supplier = 'Supplier is required';
  } else if (data.supplier.trim().length < 1 || data.supplier.trim().length > 100) {
    errors.supplier = 'Supplier must be between 1 and 100 characters';
  } else if (!/^[a-zA-Z0-9\s\.\-_,]+$/.test(data.supplier.trim())) {
    errors.supplier = 'Supplier contains invalid characters';
  }

  return errors;
}

// Selectors for convenience
export const useFormData = () => useRegistrationStore(state => state.formData);
export const useFormErrors = () => useRegistrationStore(state => state.errors);
export const useIsSubmitting = () => useRegistrationStore(state => state.isSubmitting);
export const useCapturedImage = () => useRegistrationStore(state => state.capturedImage);
export const useCurrentOcrResult = () => useRegistrationStore(state => state.currentOcrResult);
export const useRecentRegistrations = () => useRegistrationStore(state => state.recentRegistrations);