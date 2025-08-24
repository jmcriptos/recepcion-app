import React, { useState, useEffect } from 'react';
import { Alert, Platform } from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Center,
  useToast,
} from 'native-base';
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
import { CapturedImage, CameraState, CameraError } from '../../types/camera';
import PhotoStorageService from '../../services/photo-storage-service';
import ImageCompressionService from '../../utils/image-compression';
import { useIsOnline } from '../../stores/offline-store';
import uuid from 'react-native-uuid';

interface CameraCaptureProps {
  onImageCaptured: (image: CapturedImage) => void;
  onCancel: () => void;
}

export const CameraCapture: React.FC<CameraCaptureProps> = ({
  onImageCaptured,
  onCancel,
}) => {
  const [cameraState, setCameraState] = useState<CameraState>({
    isInitialized: false,
    hasPermissions: false,
    isCapturing: false,
    flashEnabled: false,
    cameraType: 'back',
    error: null,
  });

  const [isProcessingPhoto, setIsProcessingPhoto] = useState(false);

  const toast = useToast();
  const isOnline = useIsOnline();

  useEffect(() => {
    initializeCamera();
    initializePhotoStorage();
  }, []);

  const initializePhotoStorage = async () => {
    try {
      const photoStorage = PhotoStorageService.getInstance();
      await photoStorage.initializeStorage();
      console.log('✅ Photo storage initialized');
    } catch (error) {
      console.error('❌ Failed to initialize photo storage:', error);
    }
  };

  const initializeCamera = async () => {
    try {
      const hasPermissions = await requestCameraPermissions();
      setCameraState(prev => ({
        ...prev,
        hasPermissions,
        isInitialized: true,
        error: hasPermissions ? null : 'PERMISSION_DENIED',
      }));
    } catch (error) {
      setCameraState(prev => ({
        ...prev,
        error: 'CAMERA_UNAVAILABLE',
        isInitialized: true,
      }));
    }
  };

  const requestCameraPermissions = async (): Promise<boolean> => {
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

      return cameraResult === RESULTS.GRANTED && 
             (storageResult === RESULTS.GRANTED || Platform.OS === 'ios');
    } catch (error) {
      return false;
    }
  };

  /**
   * Process captured photo with compression and local storage
   */
  const processAndStorePhoto = async (asset: any) => {
    setIsProcessingPhoto(true);
    
    try {
      // Generate unique photo ID
      const photoId = uuid.v4() as string;
      
      // Initialize services
      const photoStorage = PhotoStorageService.getInstance();
      const imageCompression = ImageCompressionService.getInstance();
      
      // Validate image first
      const validation = await imageCompression.validateImage(asset.uri);
      if (!validation.isValid) {
        throw new Error(`Invalid image: ${validation.errors.join(', ')}`);
      }

      // Get optimal compression settings based on image size
      const compressionOptions = await imageCompression.getOptimalSettings(asset.uri);
      
      // Compress image for local storage
      const compressionResult = await imageCompression.compressImage(asset.uri, {
        ...compressionOptions,
        // Optimize for OCR readability while keeping file size reasonable
        maxWidth: 2048,
        maxHeight: 1536,
        quality: 85,
        targetSizeKB: 1536, // 1.5MB target for OCR quality
      });

      // Store compressed photo locally
      const photoMetadata = await photoStorage.storePhoto(compressionResult.uri, photoId);
      
      // Create captured image object with local storage metadata
      const capturedImage: CapturedImage = {
        uri: compressionResult.uri, // Use compressed image URI
        fileName: asset.fileName || `photo_${photoId}.jpg`,
        fileSize: compressionResult.size,
        type: asset.type || 'image/jpeg',
        width: compressionResult.width,
        height: compressionResult.height,
        timestamp: Date.now(),
        metadata: {
          localPhotoId: photoId,
          originalSize: asset.fileSize || compressionResult.originalSize,
          compressionRatio: compressionResult.compressionRatio,
          storedLocally: true,
          compressedPath: photoMetadata.compressedPath,
          originalPath: photoMetadata.originalPath,
        }
      };

      // Show success feedback
      toast.show({
        title: isOnline ? '📷 Foto Capturada' : '📱 Foto Guardada Localmente',
        description: `Comprimida ${(compressionResult.compressionRatio * 100).toFixed(0)}% (${formatFileSize(compressionResult.originalSize)} → ${formatFileSize(compressionResult.size)})`,
        duration: 2000,
        placement: 'top',
      });

      onImageCaptured(capturedImage);
      
    } catch (error) {
      console.error('❌ Photo processing failed:', error);
      setCameraState(prev => ({ ...prev, error: 'PROCESSING_FAILED' }));
      
      toast.show({
        title: 'Error al procesar foto',
        description: 'No se pudo comprimir y guardar la imagen. Inténtalo de nuevo.',
        duration: 4000,
        placement: 'top',
      });
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  /**
   * Format file size for display
   */
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const captureImage = async () => {
    if (!cameraState.hasPermissions) {
      showPermissionError();
      return;
    }

    setCameraState(prev => ({ ...prev, isCapturing: true }));

    const options: CameraOptions = {
      mediaType: 'photo' as MediaType,
      quality: 0.95 as any, // Very high quality for OCR (95%)
      maxWidth: 4000, // 4000x3000 = 12MP (exceeds 8MP requirement)
      maxHeight: 3000,
      includeBase64: false,
      saveToPhotos: false,
      // Enable auto-focus for clear label text
      cameraType: cameraState.cameraType,
      // Additional OCR-optimized settings
      // selectionLimit: 1, // Not available in CameraOptions
      presentationStyle: 'fullScreen',
    };

    launchCamera(options, async (response: ImagePickerResponse) => {
      setCameraState(prev => ({ ...prev, isCapturing: false }));

      if (response.didCancel) {
        return;
      }

      if (response.errorMessage) {
        setCameraState(prev => ({ ...prev, error: 'CAPTURE_FAILED' }));
        toast.show({
          title: 'Error al capturar imagen',
          description: 'No se pudo tomar la foto. Inténtalo de nuevo.',
        });
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        
        // Process photo with local storage and compression
        await processAndStorePhoto(asset);
      }
    });
  };

  const showPermissionError = () => {
    Alert.alert(
      'Permisos de Cámara',
      'Esta aplicación necesita acceso a la cámara para capturar fotos de etiquetas. Ve a Configuración > Aplicaciones > Recepción de Carnes > Permisos y habilita la cámara.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Configuración', onPress: () => {
          // TODO: Implement deep linking to device settings
          // For iOS: Linking.openURL('app-settings:')
          // For Android: Linking.openSettings()
        } },
      ]
    );
  };

  const toggleFlash = () => {
    setCameraState(prev => ({
      ...prev,
      flashEnabled: !prev.flashEnabled,
    }));
  };

  const toggleCamera = () => {
    setCameraState(prev => ({
      ...prev,
      cameraType: prev.cameraType === 'back' ? 'front' : 'back',
    }));
  };

  if (!cameraState.isInitialized) {
    return (
      <Center flex={1} bg="black">
        <Text color="white" fontSize="lg">Inicializando cámara...</Text>
      </Center>
    );
  }

  if (cameraState.error === 'PERMISSION_DENIED') {
    return (
      <Center flex={1} bg="black" px={6}>
        <VStack space={4} alignItems="center">
          <Text color="white" fontSize="xl" textAlign="center">
            Permisos de Cámara Requeridos
          </Text>
          <Text color="gray.300" fontSize="md" textAlign="center">
            Para capturar fotos de etiquetas, necesitamos acceso a tu cámara.
          </Text>
          <Button
            size="lg"
            minH="60px"
            onPress={initializeCamera}
            _text={{ fontSize: 'lg', fontWeight: 'bold' }}
          >
            Intentar de Nuevo
          </Button>
          <Button
            variant="outline"
            size="lg"
            minH="60px"
            onPress={onCancel}
            _text={{ fontSize: 'lg', fontWeight: 'bold' }}
          >
            Cancelar
          </Button>
        </VStack>
      </Center>
    );
  }

  return (
    <Box flex={1} bg="black">
      {/* Camera viewfinder with label focusing guides */}
      <Center flex={1}>
        {/* Main focusing frame */}
        <Box
          width="85%"
          height="60%"
          position="relative"
        >
          {/* Corner guides for optimal positioning */}
          <Box
            position="absolute"
            top={0}
            left={0}
            width="60px"
            height="60px"
            borderTopWidth={4}
            borderLeftWidth={4}
            borderColor="yellow.400"
            borderTopLeftRadius="lg"
          />
          <Box
            position="absolute"
            top={0}
            right={0}
            width="60px"
            height="60px"
            borderTopWidth={4}
            borderRightWidth={4}
            borderColor="yellow.400"
            borderTopRightRadius="lg"
          />
          <Box
            position="absolute"
            bottom={0}
            left={0}
            width="60px"
            height="60px"
            borderBottomWidth={4}
            borderLeftWidth={4}
            borderColor="yellow.400"
            borderBottomLeftRadius="lg"
          />
          <Box
            position="absolute"
            bottom={0}
            right={0}
            width="60px"
            height="60px"
            borderBottomWidth={4}
            borderRightWidth={4}
            borderColor="yellow.400"
            borderBottomRightRadius="lg"
          />

          {/* Center crosshair for precise alignment */}
          <Center flex={1}>
            <Box
              width="40px"
              height="40px"
              borderWidth={2}
              borderColor="green.400"
              borderRadius="full"
              position="relative"
            >
              <Box
                position="absolute"
                top="18px"
                left="-10px"
                width="20px"
                height="4px"
                bg="green.400"
              />
              <Box
                position="absolute"
                top="18px"
                right="-10px"
                width="20px"
                height="4px"
                bg="green.400"
              />
              <Box
                position="absolute"
                top="-10px"
                left="18px"
                width="4px"
                height="20px"
                bg="green.400"
              />
              <Box
                position="absolute"
                bottom="-10px"
                left="18px"
                width="4px"
                height="20px"
                bg="green.400"
              />
            </Box>
          </Center>

          {/* Label positioning instructions */}
          <Box
            position="absolute"
            bottom="-100px"
            left={0}
            right={0}
          >
            <Text color="white" fontSize="lg" textAlign="center" fontWeight="bold">
              Coloca la etiqueta dentro del marco amarillo
            </Text>
            <Text color="gray.300" fontSize="md" textAlign="center" mt={1}>
              Alinea el texto con el centro verde para mejor OCR
            </Text>
            <Text color="yellow.300" fontSize="sm" textAlign="center" mt={1}>
              📱 Mantén firme el dispositivo por 2 segundos para auto-enfoque
            </Text>
          </Box>
        </Box>
      </Center>

      {/* Camera controls - Industrial-friendly design */}
      <VStack space={6} p={6} bg="rgba(0,0,0,0.8)">
        {/* Top row: Flash and Camera switch */}
        <HStack justifyContent="space-between" alignItems="center">
          <Button
            leftIcon={<Text fontSize="2xl">⚡</Text>}
            variant={cameraState.flashEnabled ? "solid" : "outline"}
            bg={cameraState.flashEnabled ? 'yellow.500' : 'transparent'}
            borderColor="white"
            minH="60px"
            minW="120px"
            onPress={toggleFlash}
            _text={{ 
              color: cameraState.flashEnabled ? 'black' : 'white', 
              fontSize: 'md', 
              fontWeight: 'bold' 
            }}
          >
            Flash
          </Button>

          <Button
            leftIcon={<Text fontSize="2xl">🔄</Text>}
            variant="outline"
            borderColor="white"
            minH="60px"
            minW="120px"
            onPress={toggleCamera}
            _text={{ color: 'white', fontSize: 'md', fontWeight: 'bold' }}
          >
            Cambiar
          </Button>
        </HStack>

        {/* Main capture button */}
        <Center>
          <Button
            size="xl"
            minH="100px"
            minW="100px"
            borderRadius="full"
            bg="blue.500"
            borderWidth={4}
            borderColor="white"
            isLoading={cameraState.isCapturing || isProcessingPhoto}
            isLoadingText={cameraState.isCapturing ? "Capturando..." : "Procesando..."}
            onPress={captureImage}
            isDisabled={cameraState.isCapturing || isProcessingPhoto}
            _pressed={{ bg: 'blue.600' }}
            _text={{ color: 'white', fontSize: '2xl', fontWeight: 'bold' }}
            shadow={8}
          >
            📷
          </Button>
          
          {/* Processing indicator */}
          {isProcessingPhoto && (
            <Text color="yellow.300" fontSize="sm" mt={2} textAlign="center">
              Comprimiendo y guardando foto...
            </Text>
          )}
        </Center>

        {/* Cancel button */}
        <Button
          variant="outline"
          size="lg"
          minH="60px"
          onPress={onCancel}
          borderColor="red.400"
          _text={{ color: 'red.400', fontSize: 'lg', fontWeight: 'bold' }}
        >
          Cancelar
        </Button>
      </VStack>
    </Box>
  );
};