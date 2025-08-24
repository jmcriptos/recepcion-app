import React, { useState } from 'react';
import { Dimensions, ScrollView } from 'react-native';
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Image,
  Center,
  Badge,
  useToast,
} from 'native-base';
import { CapturedImage } from '../../types/camera';
import { 
  compressImage, 
  validateImageForOCR, 
  estimateOCRPerformance,
  calculateCompressionPercentage 
} from '../../utils/image-processing';
import PhotoStorageService from '../../services/photo-storage-service';
import { useOfflineStore } from '../../stores/offline-store';

interface PhotoPreviewProps {
  capturedImage: CapturedImage;
  onRetakePhoto: () => void;
  onUsePhoto: (image: CapturedImage) => void;
}

export const PhotoPreview: React.FC<PhotoPreviewProps> = ({
  capturedImage,
  onRetakePhoto,
  onUsePhoto,
}) => {
  const [imageQuality, setImageQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const { networkStatus } = useOfflineStore();
  
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
  const maxImageHeight = screenHeight * 0.6; // 60% of screen height

  React.useEffect(() => {
    // Simulate basic image quality analysis
    analyzeImageQuality();
  }, [capturedImage]);

  const analyzeImageQuality = async () => {
    // Use advanced image validation from image-processing utils
    const validation = validateImageForOCR(capturedImage);
    const ocrEstimate = estimateOCRPerformance(capturedImage);
    
    // Determine quality based on OCR confidence
    if (ocrEstimate.confidence >= 0.8) {
      setImageQuality('good');
    } else if (ocrEstimate.confidence >= 0.6) {
      setImageQuality('fair');
    } else {
      setImageQuality('poor');
    }
    
    // Show validation issues if any
    if (!validation.isValid && validation.issues.length > 0) {
      console.log('Image validation issues:', validation.issues);
    }
  };

  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'Desconocido';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getQualityColor = (quality: string) => {
    switch (quality) {
      case 'good': return 'green.500';
      case 'fair': return 'yellow.500';
      case 'poor': return 'red.500';
      default: return 'gray.500';
    }
  };

  const getQualityText = (quality: string) => {
    switch (quality) {
      case 'good': return 'Excelente para OCR';
      case 'fair': return 'Aceptable para OCR';
      case 'poor': return 'Puede afectar OCR';
      default: return 'Analizando...';
    }
  };

  const handleUsePhoto = async () => {
    // Photo is already processed and stored by CameraCapture
    // Just pass it through to the registration form
    onUsePhoto(capturedImage);
  };


  return (
    <Box flex={1} bg="black">
      {/* Header with image info */}
      <Box p={4} bg="rgba(0,0,0,0.8)">
        <VStack space={2}>
          <HStack justifyContent="space-between" alignItems="center">
            <Text color="white" fontSize="xl" fontWeight="bold">
              Vista Previa de la Foto
            </Text>
            
            {!networkStatus.isConnected && (
              <Badge bg="orange.500" _text={{ color: 'white', fontWeight: 'bold' }}>
                📡 Offline
              </Badge>
            )}
          </HStack>
          
          <HStack justifyContent="space-between" alignItems="center">
            <Badge 
              bg={getQualityColor(imageQuality)} 
              _text={{ color: 'white', fontWeight: 'bold' }}
            >
              {getQualityText(imageQuality)}
            </Badge>
            
            <Text color="gray.300" fontSize="sm">
              {capturedImage.width}x{capturedImage.height} • {formatFileSize(capturedImage.fileSize)}
            </Text>
          </HStack>
        </VStack>
      </Box>

      {/* Scrollable image preview with zoom capability */}
      <Box flex={1}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          maximumZoomScale={3.0}
          minimumZoomScale={1.0}
          showsHorizontalScrollIndicator={false}
          showsVerticalScrollIndicator={false}
        >
          <Center flex={1} p={4}>
            <Image
              source={{ uri: capturedImage.uri }}
              alt="Captured label"
              width={screenWidth - 32}
              height={maxImageHeight}
              resizeMode="contain"
              borderRadius="lg"
              shadow={6}
            />
          </Center>
        </ScrollView>
        
        {/* Zoom instructions */}
        <Center p={2}>
          <Text color="gray.400" fontSize="sm" textAlign="center">
            🔍 Pellizca para hacer zoom y verificar la claridad del texto
          </Text>
        </Center>
      </Box>

      {/* Action buttons */}
      <VStack space={4} p={6} bg="rgba(0,0,0,0.9)">
        {/* Image quality warning for poor quality */}
        {imageQuality === 'poor' && (
          <Box
            bg="red.600"
            p={3}
            borderRadius="md"
            borderLeftWidth={4}
            borderLeftColor="red.400"
          >
            <Text color="white" fontSize="sm" fontWeight="bold">
              ⚠️ Calidad baja detectada
            </Text>
            <Text color="red.100" fontSize="xs" mt={1}>
              Esta imagen puede no ser óptima para OCR. Considera tomar otra foto con mejor iluminación.
            </Text>
          </Box>
        )}

        {/* Main action buttons */}
        <HStack space={4} justifyContent="space-between">
          <Button
            variant="outline"
            flex={1}
            minH="60px"
            borderColor="red.400"
            onPress={onRetakePhoto}
            _text={{ color: 'red.400', fontSize: 'lg', fontWeight: 'bold' }}
          >
            📷 Tomar Otra
          </Button>

          <Button
            flex={1}
            minH="60px"
            bg="green.500"
            onPress={handleUsePhoto}
            _pressed={{ bg: 'green.600' }}
            _text={{ color: 'white', fontSize: 'lg', fontWeight: 'bold' }}
          >
            ✓ Usar Esta Foto
          </Button>
        </HStack>

        {/* Photo processing info */}
        {capturedImage.metadata?.storedLocally && (
          <VStack space={1} alignItems="center">
            <HStack space={2} alignItems="center">
              <Text color="green.400" fontSize="sm">✓ Guardada localmente</Text>
              {capturedImage.metadata?.compressionRatio && (
                <Badge bg="blue.500" variant="solid">
                  {(capturedImage.metadata.compressionRatio * 100).toFixed(0)}% comprimida
                </Badge>
              )}
            </HStack>
            {capturedImage.metadata?.originalSize && capturedImage.fileSize && (
              <Text color="gray.400" fontSize="xs">
                {formatFileSize(capturedImage.metadata.originalSize)} → {formatFileSize(capturedImage.fileSize)}
              </Text>
            )}
          </VStack>
        )}

        {/* Additional info */}
        <Text color="gray.400" fontSize="xs" textAlign="center">
          Verifica que el texto de la etiqueta sea legible antes de continuar
        </Text>
      </VStack>
    </Box>
  );
};