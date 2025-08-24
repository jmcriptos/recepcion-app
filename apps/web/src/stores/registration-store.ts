/**
 * Registration Store - Web Version
 * Zustand store for weight registration workflow
 * Simplified for web environment (no offline-first for now)
 */

import { create } from 'zustand';

interface RegistrationFormData {
  weight: string;
  cut_type: 'jamón' | 'chuleta' | '';
  supplier: string;
}

interface WebRegistration {
  id: string;
  weight: number;
  cut_type: 'jamón' | 'chuleta';
  supplier: string;
  registered_by: string;
  created_at: string;
  photo_url?: string;
}

interface RegistrationState {
  // Form state
  formData: RegistrationFormData;
  isSubmitting: boolean;
  errors: Record<string, string>;
  
  // Image handling (for drag & drop)
  selectedImages: File[];
  
  // Recent registrations cache
  recentRegistrations: WebRegistration[];
  isLoadingRecent: boolean;
  
  // Supplier suggestions
  suppliers: string[];
  
  // Actions
  setFormData: (data: Partial<RegistrationFormData>) => void;
  setFieldError: (field: string, error: string | null) => void;
  clearErrors: () => void;
  setSelectedImages: (images: File[]) => void;
  
  // Registration operations
  submitRegistration: (registeredBy: string) => Promise<WebRegistration>;
  createRegistration: (data: { weight: number; supplier: string; cut_type: 'jamón' | 'chuleta'; registered_by: string }) => Promise<WebRegistration>;
  loadRecentRegistrations: () => Promise<void>;
  resetForm: () => void;
}

const initialFormData: RegistrationFormData = {
  weight: '',
  cut_type: '',
  supplier: '',
};

export const useRegistrationStore = create<RegistrationState>((set, get) => ({
  // Initial state
  formData: initialFormData,
  isSubmitting: false,
  errors: {},
  selectedImages: [],
  recentRegistrations: [],
  isLoadingRecent: false,
  suppliers: ['Proveedor A', 'Proveedor B', 'Proveedor C', 'Frigorifico Central', 'Carnes del Norte'],

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

  setSelectedImages: (images: File[]) => {
    set({ selectedImages: images });
  },

  // Registration operations
  submitRegistration: async (registeredBy: string): Promise<WebRegistration> => {
    const state = get();
    set({ isSubmitting: true, errors: {} });

    try {
      // Validate form data
      const validationErrors = validateFormData(state.formData);
      if (Object.keys(validationErrors).length > 0) {
        set({ errors: validationErrors, isSubmitting: false });
        throw new Error('Form validation failed');
      }

      // TODO: Replace with actual API call
      // For now, create mock registration
      const mockRegistration: WebRegistration = {
        id: Date.now().toString(),
        weight: parseFloat(state.formData.weight),
        cut_type: state.formData.cut_type as 'jamón' | 'chuleta',
        supplier: state.formData.supplier.trim(),
        registered_by: registeredBy,
        created_at: new Date().toISOString(),
        // If images were selected, we would upload them here
        photo_url: state.selectedImages.length > 0 ? 'mock-photo-url' : undefined,
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Add to recent registrations
      set(state => {
        const updatedRegistrations = [mockRegistration, ...state.recentRegistrations].slice(0, 20);
        console.log('📝 Adding new registration to list. Total registrations now:', updatedRegistrations.length);
        return {
          recentRegistrations: updatedRegistrations
        };
      });

      // Reset form
      get().resetForm();

      set({ isSubmitting: false });
      console.log('✅ Registration submitted successfully:', mockRegistration);
      
      return mockRegistration;
    } catch (error) {
      set({ isSubmitting: false });
      console.error('❌ Registration submission failed:', error);
      throw error;
    }
  },

  createRegistration: async (data: { weight: number; supplier: string; cut_type: 'jamón' | 'chuleta'; registered_by: string }): Promise<WebRegistration> => {
    try {
      // TODO: Replace with actual API call
      // For now, create mock registration
      const mockRegistration: WebRegistration = {
        id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 11),
        weight: data.weight,
        cut_type: data.cut_type,
        supplier: data.supplier.trim(),
        registered_by: data.registered_by,
        created_at: new Date().toISOString(),
      };

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Add to recent registrations
      set(state => {
        const updatedRegistrations = [mockRegistration, ...state.recentRegistrations].slice(0, 20);
        console.log('🖼️ Adding new registration from OCR to list. Total registrations now:', updatedRegistrations.length);
        return {
          recentRegistrations: updatedRegistrations
        };
      });

      console.log('✅ Registration created successfully:', mockRegistration);
      
      return mockRegistration;
    } catch (error) {
      console.error('❌ Registration creation failed:', error);
      throw error;
    }
  },

  loadRecentRegistrations: async () => {
    const currentRegistrations = get().recentRegistrations;
    
    // Only load initial mock data if we don't have any registrations yet
    if (currentRegistrations.length === 0) {
      set({ isLoadingRecent: true });
      
      try {
        // TODO: Replace with actual API call
        // For now, use mock data only on first load
        const mockRegistrations: WebRegistration[] = [
          {
            id: 'initial-1',
            weight: 15.5,
            cut_type: 'jamón',
            supplier: 'Proveedor A',
            registered_by: 'Juan Pérez',
            created_at: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 min ago
          },
          {
            id: 'initial-2',
            weight: 12.3,
            cut_type: 'chuleta',
            supplier: 'Proveedor B',
            registered_by: 'María García',
            created_at: new Date(Date.now() - 1000 * 60 * 60).toISOString(), // 1 hour ago
          },
        ];
        
        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        set({ 
          recentRegistrations: mockRegistrations,
          isLoadingRecent: false 
        });
      } catch (error) {
        console.error('❌ Failed to load recent registrations:', error);
        set({ isLoadingRecent: false });
      }
    } else {
      // If we already have registrations, just refresh them (normally would be API call)
      console.log('📊 Registrations already loaded, current count:', currentRegistrations.length);
    }
  },

  resetForm: () => {
    set({
      formData: initialFormData,
      errors: {},
      selectedImages: [],
    });
  },
}));

/**
 * Validate registration form data
 */
function validateFormData(data: RegistrationFormData): Record<string, string> {
  const errors: Record<string, string> = {};

  // Weight validation
  if (!data.weight || data.weight.trim() === '') {
    errors.weight = 'El peso es requerido';
  } else {
    const weight = parseFloat(data.weight);
    if (isNaN(weight) || weight <= 0) {
      errors.weight = 'El peso debe ser un número válido mayor a 0';
    } else if (weight < 0.1 || weight > 50) {
      errors.weight = 'El peso debe estar entre 0.1 y 50 kg';
    } else if (!/^\d+(\.\d{1,2})?$/.test(data.weight)) {
      errors.weight = 'El peso puede tener máximo 2 decimales';
    }
  }

  // Cut type validation
  if (!data.cut_type) {
    errors.cut_type = 'El tipo de corte es requerido';
  } else if (data.cut_type !== 'jamón' && data.cut_type !== 'chuleta') {
    errors.cut_type = 'El tipo de corte debe ser jamón o chuleta';
  }

  // Supplier validation
  if (!data.supplier || data.supplier.trim() === '') {
    errors.supplier = 'El proveedor es requerido';
  } else if (data.supplier.trim().length < 1 || data.supplier.trim().length > 100) {
    errors.supplier = 'El proveedor debe tener entre 1 y 100 caracteres';
  } else if (!/^[a-zA-ZÀ-ÿ0-9\s\.\-_,]+$/.test(data.supplier.trim())) {
    errors.supplier = 'El proveedor contiene caracteres no válidos';
  }

  return errors;
}

// Convenience selectors
export const useFormData = () => useRegistrationStore(state => state.formData);
export const useFormErrors = () => useRegistrationStore(state => state.errors);
export const useIsSubmitting = () => useRegistrationStore(state => state.isSubmitting);
export const useSelectedImages = () => useRegistrationStore(state => state.selectedImages);
export const useRecentRegistrations = () => useRegistrationStore(state => state.recentRegistrations);