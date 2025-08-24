/**
 * Data Validation Utilities
 * Client-side validation matching backend business rules
 */

import {
  LocalUser,
  LocalWeightRegistration,
  CreateRegistrationPayload,
  WEIGHT_VALIDATION,
  CUT_TYPES,
  USER_ROLES,
} from '../types/offline';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validate weight registration data
 */
export function validateRegistrationData(
  data: CreateRegistrationPayload
): ValidationResult {
  const errors: string[] = [];

  // Weight validation
  if (!data.weight || typeof data.weight !== 'number') {
    errors.push('Weight is required and must be a number');
  } else {
    if (data.weight <= 0) {
      errors.push('Weight must be greater than 0');
    }
    if (data.weight > WEIGHT_VALIDATION.max) {
      errors.push(`Weight cannot exceed ${WEIGHT_VALIDATION.max} kg`);
    }
    if (data.weight < WEIGHT_VALIDATION.min) {
      errors.push(`Weight must be at least ${WEIGHT_VALIDATION.min} kg`);
    }
    
    // Check precision (max 2 decimal places)
    const decimalPlaces = (data.weight.toString().split('.')[1] || '').length;
    if (decimalPlaces > WEIGHT_VALIDATION.precision) {
      errors.push(`Weight can have maximum ${WEIGHT_VALIDATION.precision} decimal places`);
    }
  }

  // Cut type validation
  if (!data.cut_type) {
    errors.push('Cut type is required');
  } else if (!CUT_TYPES.includes(data.cut_type)) {
    errors.push(`Cut type must be one of: ${CUT_TYPES.join(', ')}`);
  }

  // Supplier validation
  if (!data.supplier || typeof data.supplier !== 'string') {
    errors.push('Supplier is required');
  } else {
    const trimmedSupplier = data.supplier.trim();
    if (trimmedSupplier.length === 0) {
      errors.push('Supplier cannot be empty');
    }
    if (trimmedSupplier.length > 100) {
      errors.push('Supplier name cannot exceed 100 characters');
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\.0-9]+$/.test(trimmedSupplier)) {
      errors.push('Supplier name contains invalid characters');
    }
  }

  // Registered by validation
  if (!data.registered_by || typeof data.registered_by !== 'string') {
    errors.push('Registered by user ID is required');
  } else if (data.registered_by.trim().length === 0) {
    errors.push('Registered by user ID cannot be empty');
  }

  // Local photo path validation (optional)
  if (data.local_photo_path) {
    if (typeof data.local_photo_path !== 'string') {
      errors.push('Local photo path must be a string');
    } else if (!data.local_photo_path.includes('/')) {
      errors.push('Local photo path must be a valid file path');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate user data
 */
export function validateUserData(user: LocalUser): ValidationResult {
  const errors: string[] = [];

  // ID validation
  if (!user.id || typeof user.id !== 'string') {
    errors.push('User ID is required');
  } else if (user.id.trim().length === 0) {
    errors.push('User ID cannot be empty');
  }

  // Name validation
  if (!user.name || typeof user.name !== 'string') {
    errors.push('User name is required');
  } else {
    const trimmedName = user.name.trim();
    if (trimmedName.length === 0) {
      errors.push('User name cannot be empty');
    }
    if (trimmedName.length > 50) {
      errors.push('User name cannot exceed 50 characters');
    }
    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s\-\.]+$/.test(trimmedName)) {
      errors.push('User name contains invalid characters');
    }
  }

  // Role validation
  if (!user.role) {
    errors.push('User role is required');
  } else if (!USER_ROLES.includes(user.role)) {
    errors.push(`User role must be one of: ${USER_ROLES.join(', ')}`);
  }

  // Active status validation
  if (typeof user.active !== 'boolean') {
    errors.push('User active status must be a boolean');
  }

  // Created at validation
  if (!user.created_at || typeof user.created_at !== 'string') {
    errors.push('User created_at timestamp is required');
  } else {
    const createdAt = new Date(user.created_at);
    if (isNaN(createdAt.getTime())) {
      errors.push('User created_at must be a valid ISO timestamp');
    }
    if (createdAt > new Date()) {
      errors.push('User created_at cannot be in the future');
    }
  }

  // Last login validation (optional)
  if (user.last_login) {
    const lastLogin = new Date(user.last_login);
    if (isNaN(lastLogin.getTime())) {
      errors.push('User last_login must be a valid ISO timestamp');
    }
    if (lastLogin > new Date()) {
      errors.push('User last_login cannot be in the future');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate OCR confidence value
 */
export function validateOcrConfidence(confidence: number): ValidationResult {
  const errors: string[] = [];

  if (typeof confidence !== 'number') {
    errors.push('OCR confidence must be a number');
  } else {
    if (confidence < 0 || confidence > 1) {
      errors.push('OCR confidence must be between 0 and 1');
    }
    if (isNaN(confidence)) {
      errors.push('OCR confidence cannot be NaN');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Sanitize supplier name
 */
export function sanitizeSupplierName(supplier: string): string {
  return supplier
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .substring(0, 100); // Limit to 100 characters
}

/**
 * Sanitize user name
 */
export function sanitizeUserName(name: string): string {
  return name
    .trim()
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .substring(0, 50); // Limit to 50 characters
}

/**
 * Validate photo file path
 */
export function validatePhotoPath(photoPath: string): ValidationResult {
  const errors: string[] = [];

  if (typeof photoPath !== 'string') {
    errors.push('Photo path must be a string');
  } else {
    if (photoPath.trim().length === 0) {
      errors.push('Photo path cannot be empty');
    }
    
    // Check for valid image extensions
    const validExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
    const hasValidExtension = validExtensions.some(ext => 
      photoPath.toLowerCase().endsWith(ext)
    );
    
    if (!hasValidExtension) {
      errors.push(`Photo must have one of these extensions: ${validExtensions.join(', ')}`);
    }
    
    // Check if it looks like a valid file path
    if (!photoPath.includes('/')) {
      errors.push('Photo path must be a valid file path');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate sync queue payload
 */
export function validateSyncPayload(payload: string, operationType: string): ValidationResult {
  const errors: string[] = [];

  if (typeof payload !== 'string') {
    errors.push('Sync payload must be a string');
    return { isValid: false, errors };
  }

  try {
    const parsed = JSON.parse(payload);
    
    // Basic structure validation based on operation type
    switch (operationType) {
      case 'create_registration':
        if (!parsed.weight || !parsed.cut_type || !parsed.supplier) {
          errors.push('Registration payload missing required fields');
        }
        break;
      case 'upload_photo':
        if (!parsed.registration_id || !parsed.local_photo_path) {
          errors.push('Photo upload payload missing required fields');
        }
        break;
      case 'update_user':
        if (!parsed.user_id) {
          errors.push('User update payload missing user_id');
        }
        break;
      default:
        errors.push(`Unknown operation type: ${operationType}`);
    }
  } catch (jsonError) {
    errors.push('Sync payload must be valid JSON');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Validate date range
 */
export function validateDateRange(dateFrom?: string, dateTo?: string): ValidationResult {
  const errors: string[] = [];

  if (dateFrom) {
    const fromDate = new Date(dateFrom);
    if (isNaN(fromDate.getTime())) {
      errors.push('Date from must be a valid ISO timestamp');
    }
  }

  if (dateTo) {
    const toDate = new Date(dateTo);
    if (isNaN(toDate.getTime())) {
      errors.push('Date to must be a valid ISO timestamp');
    }
  }

  if (dateFrom && dateTo) {
    const fromDate = new Date(dateFrom);
    const toDate = new Date(dateTo);
    if (fromDate > toDate) {
      errors.push('Date from cannot be after date to');
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}