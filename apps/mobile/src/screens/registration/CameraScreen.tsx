import React, { useState } from 'react';
import { SafeAreaView } from 'react-native';
import { Box, useToast } from 'native-base';
import { CameraCapture, PhotoPreview } from '../../components/camera';
import { CapturedImage } from '../../types/camera';
import { useIsOnline } from '../../stores/offline-store';

interface CameraScreenProps {
  navigation: any;
  route: any;
}

export const CameraScreen: React.FC<CameraScreenProps> = ({ navigation, route }) => {
  const [capturedImage, setCapturedImage] = useState<CapturedImage | null>(null);
  const [currentStep, setCurrentStep] = useState<'capture' | 'preview'>('capture');
  const toast = useToast();
  const isOnline = useIsOnline();

  const handleImageCaptured = (image: CapturedImage) => {
    setCapturedImage(image);
    setCurrentStep('preview');
    
    // Show offline indicator if applicable
    if (!isOnline) {
      toast.show({
        title: '📱 Modo Offline',
        description: 'La foto se guardará localmente hasta que haya conexión',
        duration: 2000,
        placement: 'top',
      });
    }
  };

  const handleRetakePhoto = () => {
    setCapturedImage(null);
    setCurrentStep('capture');
  };

  const handleUsePhoto = (processedImage: CapturedImage) => {
    // Navigate back to registration with the captured image
    navigation.navigate('ManualEntryScreen', {
      capturedImage: processedImage,
    });
  };

  const handleCancel = () => {
    // Navigate back to registration home
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <Box flex={1}>
        {currentStep === 'capture' && (
          <CameraCapture
            onImageCaptured={handleImageCaptured}
            onCancel={handleCancel}
          />
        )}
        
        {currentStep === 'preview' && capturedImage && (
          <PhotoPreview
            capturedImage={capturedImage}
            onRetakePhoto={handleRetakePhoto}
            onUsePhoto={handleUsePhoto}
          />
        )}
      </Box>
    </SafeAreaView>
  );
};