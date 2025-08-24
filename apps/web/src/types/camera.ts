export interface CameraConfig {
  quality: number;
  maxWidth: number;
  maxHeight: number;
  storageOptions: {
    skipBackup: boolean;
    path: string;
  };
}

export interface CapturedImage {
  uri: string;
  fileName?: string;
  fileSize?: number;
  type?: string;
  width?: number;
  height?: number;
  timestamp?: number;
  metadata?: {
    localPhotoId?: string;
    originalSize?: number;
    compressionRatio?: number;
    storedLocally?: boolean;
    [key: string]: any;
  };
}

export interface CameraPermissionState {
  camera: boolean;
  storage: boolean;
  loading: boolean;
  error: string | null;
}

export interface ImageProcessingResult {
  compressedUri: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  processingTime: number;
}

export type CameraError = 
  | 'PERMISSION_DENIED'
  | 'CAMERA_UNAVAILABLE'
  | 'LOW_STORAGE'
  | 'CAPTURE_FAILED'
  | 'PROCESSING_FAILED';

export interface CameraState {
  isInitialized: boolean;
  hasPermissions: boolean;
  isCapturing: boolean;
  flashEnabled: boolean;
  cameraType: 'back' | 'front';
  error: CameraError | null;
}