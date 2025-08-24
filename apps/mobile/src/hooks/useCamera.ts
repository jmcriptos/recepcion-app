import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import {
  launchCamera,
  ImagePickerResponse,
  MediaType,
  CameraOptions,
} from 'react-native-image-picker';
import {
  request,
  check,
  PERMISSIONS,
  RESULTS,
  Permission,
} from 'react-native-permissions';
import { CapturedImage, CameraState, CameraError } from '../types/camera';
import { compressImage, validateImageForOCR } from '../utils/image-processing';

export const useCamera = () => {
  const [cameraState, setCameraState] = useState<CameraState>({
    isInitialized: false,
    hasPermissions: false,
    isCapturing: false,
    flashEnabled: false,
    cameraType: 'back',
    error: null,
  });

  const requestPermissions = useCallback(async (): Promise<boolean> => {
    const cameraPermission: Permission = Platform.select({
      ios: PERMISSIONS.IOS.CAMERA,
      android: PERMISSIONS.ANDROID.CAMERA,
    }) as Permission;

    const storagePermission: Permission = Platform.select({
      ios: PERMISSIONS.IOS.PHOTO_LIBRARY,
      android: PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE,
    }) as Permission;

    try {
      const cameraResult = await request(cameraPermission);
      const storageResult = await request(storagePermission);

      const hasPermissions = cameraResult === RESULTS.GRANTED && 
        (storageResult === RESULTS.GRANTED || Platform.OS === 'ios');
      
      setCameraState(prev => ({
        ...prev,
        hasPermissions,
        error: hasPermissions ? null : 'PERMISSION_DENIED',
      }));

      return hasPermissions;
    } catch (error) {
      setCameraState(prev => ({
        ...prev,
        hasPermissions: false,
        error: 'PERMISSION_DENIED',
      }));
      return false;
    }
  }, []);

  const checkPermissions = useCallback(async (): Promise<boolean> => {
    const cameraPermission: Permission = Platform.select({
      ios: PERMISSIONS.IOS.CAMERA,
      android: PERMISSIONS.ANDROID.CAMERA,
    }) as Permission;

    try {
      const result = await check(cameraPermission);
      const hasPermissions = result === RESULTS.GRANTED;
      
      setCameraState(prev => ({
        ...prev,
        hasPermissions,
        error: hasPermissions ? null : 'PERMISSION_DENIED',
      }));

      return hasPermissions;
    } catch (error) {
      return false;
    }
  }, []);

  const initializeCamera = useCallback(async () => {
    setCameraState(prev => ({ ...prev, isInitialized: false }));
    
    try {
      const hasPermissions = await checkPermissions();
      
      if (!hasPermissions) {
        await requestPermissions();
      }

      setCameraState(prev => ({
        ...prev,
        isInitialized: true,
      }));
    } catch (error) {
      setCameraState(prev => ({
        ...prev,
        isInitialized: true,
        error: 'CAMERA_UNAVAILABLE',
      }));
    }
  }, [checkPermissions, requestPermissions]);

  const captureImage = useCallback(async (): Promise<CapturedImage | null> => {
    if (!cameraState.hasPermissions) {
      setCameraState(prev => ({ ...prev, error: 'PERMISSION_DENIED' }));
      return null;
    }

    setCameraState(prev => ({ ...prev, isCapturing: true, error: null }));

    const options: CameraOptions = {
      mediaType: 'photo' as MediaType,
      quality: 0.95 as any, // Very high quality for OCR
      maxWidth: 4000, // 4000x3000 = 12MP (exceeds 8MP requirement)
      maxHeight: 3000,
      includeBase64: false,
      saveToPhotos: false,
      cameraType: cameraState.cameraType,
      // selectionLimit: 1, // Not available in CameraOptions
      presentationStyle: 'fullScreen',
    };

    return new Promise((resolve) => {
      launchCamera(options, (response: ImagePickerResponse) => {
        setCameraState(prev => ({ ...prev, isCapturing: false }));

        if (response.didCancel) {
          resolve(null);
          return;
        }

        if (response.errorMessage) {
          setCameraState(prev => ({ ...prev, error: 'CAPTURE_FAILED' }));
          resolve(null);
          return;
        }

        if (response.assets && response.assets[0]) {
          const asset = response.assets[0];
          const capturedImage: CapturedImage = {
            uri: asset.uri!,
            fileName: asset.fileName,
            fileSize: asset.fileSize,
            type: asset.type,
            width: asset.width,
            height: asset.height,
            timestamp: Date.now(),
          };

          resolve(capturedImage);
        } else {
          setCameraState(prev => ({ ...prev, error: 'CAPTURE_FAILED' }));
          resolve(null);
        }
      });
    });
  }, [cameraState.hasPermissions, cameraState.cameraType]);

  const processImage = useCallback(async (image: CapturedImage) => {
    try {
      // Validate image for OCR
      const validation = validateImageForOCR(image);
      
      // Compress image for optimal transmission
      const compressionResult = await compressImage(image);
      
      return {
        processedImage: {
          ...image,
          uri: compressionResult.compressedUri,
          fileSize: compressionResult.compressedSize,
        },
        validation,
        compressionResult,
      };
    } catch (error) {
      throw new Error(`Image processing failed: ${error}`);
    }
  }, []);

  const toggleFlash = useCallback(() => {
    setCameraState(prev => ({
      ...prev,
      flashEnabled: !prev.flashEnabled,
    }));
  }, []);

  const toggleCameraType = useCallback(() => {
    setCameraState(prev => ({
      ...prev,
      cameraType: prev.cameraType === 'back' ? 'front' : 'back',
    }));
  }, []);

  const resetCamera = useCallback(() => {
    setCameraState({
      isInitialized: false,
      hasPermissions: false,
      isCapturing: false,
      flashEnabled: false,
      cameraType: 'back',
      error: null,
    });
  }, []);

  const clearError = useCallback(() => {
    setCameraState(prev => ({ ...prev, error: null }));
  }, []);

  return {
    // State
    cameraState,
    
    // Actions
    initializeCamera,
    requestPermissions,
    checkPermissions,
    captureImage,
    processImage,
    toggleFlash,
    toggleCameraType,
    resetCamera,
    clearError,
    
    // Computed properties
    isReady: cameraState.isInitialized && cameraState.hasPermissions && !cameraState.error,
    canCapture: cameraState.hasPermissions && !cameraState.isCapturing,
  };
};