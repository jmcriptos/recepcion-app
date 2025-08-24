/**
 * Offline Data Types
 * Local data models that mirror backend structures with offline enhancements
 */

export type SyncStatus = 'pending' | 'synced' | 'failed';

export type OperationType = 'create_registration' | 'upload_photo' | 'update_user';

export interface LocalUser {
  id: string;
  name: string;
  role: 'operator' | 'supervisor';
  active: boolean;
  created_at: string;
  last_login?: string;
}

export interface LocalWeightRegistration {
  id: string;
  weight: number;
  cut_type: 'jamón' | 'chuleta';
  supplier: string;
  photo_url?: string;
  local_photo_path?: string;
  ocr_confidence?: number;
  sync_status: SyncStatus;
  registered_by: string;
  created_at: string;
  updated_at: string;
}

export interface SyncQueueItem {
  id: string;
  operation_type: OperationType;
  entity_id: string;
  payload: string; // JSON string
  priority: number;
  retry_count: number;
  last_attempt_at?: string;
  error_message?: string;
  created_at: string;
}

export interface CreateRegistrationPayload {
  weight: number;
  cut_type: 'jamón' | 'chuleta';
  supplier: string;
  local_photo_path?: string;
  registered_by: string;
}

export interface UploadPhotoPayload {
  registration_id: string;
  local_photo_path: string;
  compressed_photo_path: string;
}

export interface UpdateUserPayload {
  user_id: string;
  last_login: string;
}

export interface DatabaseStats {
  registrationsCount: number;
  pendingSyncCount: number;
  queueCount: number;
  databaseSize: number;
}

export interface NetworkStatus {
  isConnected: boolean;
  type: string;
  isInternetReachable: boolean;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  currentOperation?: string;
}

// Validation schemas for data integrity
export const WEIGHT_VALIDATION = {
  min: 0.1,
  max: 50,
  precision: 2,
};

// OCR Result interface
export interface OCRResult {
  text: string;
  confidence: number;
  processing_type: 'local' | 'server' | 'manual';
  needs_server_processing: boolean;
  processing_time: number;
  error?: string;
}

export const CUT_TYPES = ['jamón', 'chuleta'] as const;
export const USER_ROLES = ['operator', 'supervisor'] as const;
export const SYNC_STATUSES = ['pending', 'synced', 'failed'] as const;
export const OPERATION_TYPES = ['create_registration', 'upload_photo', 'update_user'] as const;