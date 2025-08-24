import React, { useEffect } from 'react';
import { SafeAreaView } from 'react-native';
import { Box, VStack, Text, HStack, useToast } from 'native-base';
import { OfflineRegistrationForm } from '../../components/registration/OfflineRegistrationForm';
import { ConnectionStatusCard } from '../../components/connection-status';
import { useRegistrationStore } from '../../stores/registration-store';
import { useIsOnline } from '../../stores/offline-store';
import { CapturedImage } from '../../types/camera';

interface ManualEntryScreenProps {
  navigation: any;
  route: {
    params?: {
      capturedImage?: CapturedImage;
    };
  };
}

export const ManualEntryScreen: React.FC<ManualEntryScreenProps> = ({ 
  navigation, 
  route 
}) => {
  const capturedImage = route.params?.capturedImage;
  const toast = useToast();
  const isOnline = useIsOnline();
  const { loadRecentRegistrations } = useRegistrationStore();

  useEffect(() => {
    // Load recent registrations when screen loads
    loadRecentRegistrations();
  }, [loadRecentRegistrations]);

  const handleSuccess = (registrationId: string) => {
    toast.show({
      title: isOnline ? '✅ Registro Guardado' : '📱 Guardado Localmente',
      description: isOnline 
        ? 'El registro se ha sincronizado exitosamente'
        : 'Se sincronizará automáticamente cuando haya conexión',
      duration: 3000,
      placement: 'top',
    });

    // Navigate back to main registration screen
    navigation.navigate('RegistrationHome', {
      successMessage: `Registro ${registrationId} creado exitosamente`,
    });
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <Box flex={1}>
        {/* Header with connection status */}
        <VStack space={0}>
          <Box bg="white" px={4} py={3} shadow={1}>
            <HStack justifyContent="space-between" alignItems="center">
              <Text fontSize="xl" fontWeight="bold" color="gray.800">
                Registro de Peso
              </Text>
              <ConnectionStatusCard />
            </HStack>
          </Box>

          {/* Main Form */}
          <Box flex={1}>
            <OfflineRegistrationForm
              capturedImage={capturedImage}
              onSuccess={handleSuccess}
              onCancel={handleCancel}
            />
          </Box>
        </VStack>
      </Box>
    </SafeAreaView>
  );
};

export default ManualEntryScreen;