import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  VStack,
  HStack,
  Text,
  Input,
  Select,
  Button,
  FormControl,
  useToast,
  Image,
  AlertDialog,
  CheckIcon,
  Badge,
  Spinner,
} from 'native-base';
import { 
  useRegistrationStore,
  useFormData,
  useFormErrors,
  useIsSubmitting,
  useCapturedImage,
  useCurrentOcrResult
} from '../../stores/registration-store';
import { useOfflineStore, useIsOnline } from '../../stores/offline-store';
import { CUT_TYPES, WEIGHT_VALIDATION } from '../../types/offline';
import { CapturedImage } from '../../types/camera';
import OCRService, { OCRResult } from '../../services/ocr-service';

interface OfflineRegistrationFormProps {
  capturedImage?: CapturedImage;
  onSuccess?: (registrationId: string) => void;
  onCancel?: () => void;
}

export const OfflineRegistrationForm: React.FC<OfflineRegistrationFormProps> = ({
  capturedImage,
  onSuccess,
  onCancel,
}) => {
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isProcessingOCR, setIsProcessingOCR] = useState(false);
  const cancelRef = useRef(null);

  const toast = useToast();
  
  // Store hooks
  const { 
    setFormData,
    setCapturedImage,
    setCurrentOcrResult,
    submitRegistration,
    resetForm,
    clearErrors
  } = useRegistrationStore();
  
  const formData = useFormData();
  const formErrors = useFormErrors();
  const isSubmitting = useIsSubmitting();
  const storedImage = useCapturedImage();
  const ocrResult = useCurrentOcrResult();
  
  const isOnline = useIsOnline();
  const { networkStatus } = useOfflineStore();

  useEffect(() => {
    if (capturedImage) {
      setCapturedImage(capturedImage);
      
      // Start OCR processing if we have an image
      processImageWithOCR(capturedImage.uri);
    }
  }, [capturedImage, setCapturedImage]);

  const processImageWithOCR = async (imageUri: string) => {
    if (!imageUri) return;
    
    setIsProcessingOCR(true);
    try {
      const ocrService = OCRService.getInstance();
      const result = await ocrService.processImage(imageUri, {
        confidenceThreshold: 0.6,
        allowFallback: networkStatus.isConnected,
      });
      
      setCurrentOcrResult(result);
      
      // Auto-fill weight if OCR was successful (handled automatically by store)
      if (result.confidence >= 0.6 && result.text) {
        const weightExtraction = ocrService.extractWeightFromText(result.text);
        if (weightExtraction.weight) {
          toast.show({
            title: `Peso detectado: ${weightExtraction.weight} kg`,
            description: `OCR ${result.processing_type} (${Math.round(result.confidence * 100)}% confianza)`,
            placement: 'top',
          });
        }
      }
      
      // Show OCR status
      if (result.processing_type === 'manual') {
        toast.show({
          title: 'OCR requiere entrada manual',
          description: 'La calidad de la imagen no permite detección automática',
          placement: 'top',
        });
      }
      
    } catch (error) {
      console.error('OCR processing failed:', error);
      toast.show({
        title: 'Error en OCR',
        description: 'No se pudo procesar la imagen automáticamente',
        placement: 'top',
      });
    } finally {
      setIsProcessingOCR(false);
    }
  };

  // Form validation is now handled by the store

  const handleSave = () => {
    // Clear any previous errors
    clearErrors();
    setShowConfirmDialog(true);
  };

  const handleConfirmSubmit = async () => {
    setShowConfirmDialog(false);

    try {
      const registration = await submitRegistration('current_user'); // TODO: Get from user store
      
      toast.show({
        title: isOnline ? 'Registro guardado' : 'Guardado localmente',
        description: isOnline 
          ? 'El registro se ha sincronizado exitosamente'
          : 'Se sincronizará cuando haya conexión',
        duration: 3000,
      });

      onSuccess?.(registration.id);
    } catch (error) {
      console.error('Registration submission failed:', error);
      
      // Show specific validation errors if available
      if ((error as Error).message === 'Form validation failed') {
        toast.show({
          title: 'Revisa los datos',
          description: 'Algunos campos requieren corrección.',
          duration: 4000,
        });
      } else {
        toast.show({
          title: 'Error al guardar',
          description: 'No se pudo guardar el registro. Intenta nuevamente.',
          duration: 4000,
        });
      }
    }
  };

  return (
    <Box flex={1} bg="white" p={6}>
      <VStack space={6}>
        {/* Offline Indicator */}
        {!networkStatus.isConnected && (
          <Box
            bg="orange.100"
            borderColor="orange.300"
            borderWidth={1}
            borderRadius="md"
            p={3}
          >
            <HStack space={2} alignItems="center">
              <Text fontSize="lg">📡</Text>
              <Text fontSize="md" color="orange.700" fontWeight="bold">
                Modo Offline - Los datos se guardarán localmente
              </Text>
            </HStack>
          </Box>
        )}

        {/* Photo Preview */}
        {capturedImage && (
          <Box>
            <HStack justifyContent="space-between" alignItems="center" mb={3}>
              <Text fontSize="lg" fontWeight="bold">
                Foto Capturada
              </Text>
              
              {isProcessingOCR && (
                <HStack space={2} alignItems="center">
                  <Spinner size="sm" color="blue.500" />
                  <Text fontSize="sm" color="blue.600">Procesando OCR...</Text>
                </HStack>
              )}
              
              {ocrResult && !isProcessingOCR && (
                <Badge
                  bg={ocrResult.processing_type === 'local' ? 'green.500' : 
                      ocrResult.processing_type === 'server' ? 'blue.500' : 'orange.500'}
                  _text={{ color: 'white', fontSize: 'xs', fontWeight: 'bold' }}
                >
                  OCR {ocrResult.processing_type === 'local' ? 'Local' : 
                       ocrResult.processing_type === 'server' ? 'Servidor' : 'Manual'}
                </Badge>
              )}
            </HStack>
            
            <Image
              source={{ uri: capturedImage.uri }}
              alt="Captured registration photo"
              width="100%"
              height={200}
              borderRadius="md"
              resizeMode="cover"
            />
            
            {ocrResult && ocrResult.text && !isProcessingOCR && (
              <Box mt={2} p={2} bg="gray.100" borderRadius="md">
                <Text fontSize="sm" color="gray.700" fontWeight="semibold">
                  Texto detectado: "{ocrResult.text}"
                </Text>
                <Text fontSize="xs" color="gray.600">
                  Confianza: {Math.round(ocrResult.confidence * 100)}% • 
                  Tiempo: {ocrResult.processing_time}ms
                </Text>
              </Box>
            )}
          </Box>
        )}

        {/* Registration Form */}
        <VStack space={4}>
          <Text fontSize="xl" fontWeight="bold">
            Datos del Registro
          </Text>

          {/* Weight Input */}
          <FormControl isInvalid={!!formErrors.weight}>
            <FormControl.Label>
              <Text fontSize="md" fontWeight="semibold">Peso (kg)</Text>
            </FormControl.Label>
            <Input
              size="lg"
              value={formData.weight}
              onChangeText={(value) => setFormData({ weight: value })}
              placeholder="Ej: 25.5"
              keyboardType="decimal-pad"
              bg="gray.50"
              borderColor="gray.300"
              _focus={{ borderColor: 'blue.500', bg: 'white' }}
            />
            <FormControl.ErrorMessage>{formErrors.weight}</FormControl.ErrorMessage>
          </FormControl>

          {/* Cut Type Select */}
          <FormControl isInvalid={!!formErrors.cut_type}>
            <FormControl.Label>
              <Text fontSize="md" fontWeight="semibold">Tipo de Corte</Text>
            </FormControl.Label>
            <Select
              selectedValue={formData.cut_type}
              onValueChange={(value) => setFormData({ cut_type: value as 'jamón' | 'chuleta' })}
              size="lg"
              bg="gray.50"
              borderColor="gray.300"
              _selectedItem={{
                bg: 'blue.500',
                endIcon: <CheckIcon size="5" />,
              }}
            >
              {CUT_TYPES.map((type) => (
                <Select.Item key={type} label={type} value={type} />
              ))}
            </Select>
            <FormControl.ErrorMessage>{formErrors.cut_type}</FormControl.ErrorMessage>
          </FormControl>

          {/* Supplier Input */}
          <FormControl isInvalid={!!formErrors.supplier}>
            <FormControl.Label>
              <Text fontSize="md" fontWeight="semibold">Proveedor</Text>
            </FormControl.Label>
            <Input
              size="lg"
              value={formData.supplier}
              onChangeText={(value) => setFormData({ supplier: value })}
              placeholder="Nombre del proveedor"
              bg="gray.50"
              borderColor="gray.300"
              _focus={{ borderColor: 'blue.500', bg: 'white' }}
            />
            <FormControl.ErrorMessage>{formErrors.supplier}</FormControl.ErrorMessage>
          </FormControl>
        </VStack>

        {/* Action Buttons */}
        <VStack space={3} mt={6}>
          <Button
            size="lg"
            minH="60px"
            bg="blue.500"
            onPress={handleSave}
            isLoading={isSubmitting}
            isDisabled={isSubmitting}
            _text={{ fontSize: 'lg', fontWeight: 'bold' }}
          >
            {isSubmitting ? 'Guardando...' : 'Guardar Registro'}
          </Button>

          {onCancel && (
            <Button
              size="lg"
              minH="60px"
              variant="outline"
              borderColor="gray.400"
              onPress={onCancel}
              isDisabled={isSubmitting}
              _text={{ color: 'gray.600', fontSize: 'lg', fontWeight: 'bold' }}
            >
              Cancelar
            </Button>
          )}
        </VStack>
      </VStack>

      {/* Confirmation Dialog */}
      <AlertDialog 
        isOpen={showConfirmDialog} 
        onClose={() => setShowConfirmDialog(false)}
        leastDestructiveRef={cancelRef}
      >
        <AlertDialog.Content>
          <AlertDialog.CloseButton />
          <AlertDialog.Header>Confirmar Registro</AlertDialog.Header>
          <AlertDialog.Body>
            <VStack space={2}>
              <Text>
                <Text fontWeight="bold">Peso:</Text> {formData.weight} kg
              </Text>
              <Text>
                <Text fontWeight="bold">Corte:</Text> {formData.cut_type}
              </Text>
              <Text>
                <Text fontWeight="bold">Proveedor:</Text> {formData.supplier}
              </Text>
              {!isOnline && (
                <Text fontSize="sm" color="orange.600" mt={2}>
                  ⚠️ Sin conexión: Se guardará localmente y se sincronizará después
                </Text>
              )}
            </VStack>
          </AlertDialog.Body>
          <AlertDialog.Footer>
            <Button.Group space={2}>
              <Button
                ref={cancelRef}
                variant="outline"
                onPress={() => setShowConfirmDialog(false)}
              >
                Cancelar
              </Button>
              <Button
                bg="blue.500"
                onPress={handleConfirmSubmit}
                isLoading={isSubmitting}
              >
                Confirmar
              </Button>
            </Button.Group>
          </AlertDialog.Footer>
        </AlertDialog.Content>
      </AlertDialog>
    </Box>
  );
};