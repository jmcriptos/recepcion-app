import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CameraScreen } from '../screens/registration/CameraScreen';
import { CapturedImage } from '../types/camera';
import { LocalWeightRegistration } from '../types/offline';
import { useOfflineStore } from '../stores/offline-store';
import { useRecentRegistrations, useRegistrationStore } from '../stores/registration-store';
import { SyncStatusCounter } from '../components/sync/SyncStatusCounter';
import { SyncStatusScreen } from '../screens/sync/SyncStatusScreen';

// Placeholder screens - these will be implemented in future stories
const RegistrationHomeScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { Box, Button, VStack, Text, Center, HStack } = require('native-base');
  const { networkStatus, syncProgress } = useOfflineStore();
  const recentRegistrations = useRecentRegistrations();
  const { loadRecentRegistrations } = useRegistrationStore();
  
  React.useEffect(() => {
    loadRecentRegistrations();
  }, [loadRecentRegistrations]);
  
  return (
    <Box flex={1} bg="white" p={6}>
      {/* Network Status Indicator */}
      <Box mb={4}>
        <HStack space={3} alignItems="center" justifyContent="space-between">
          <HStack space={2} alignItems="center">
            <Text fontSize="lg">
              {networkStatus.isConnected ? '🌐' : '📡'}
            </Text>
            <Text 
              fontSize="md" 
              color={networkStatus.isConnected ? 'green.600' : 'orange.600'}
              fontWeight="semibold"
            >
              {networkStatus.isConnected ? 'En línea' : 'Offline'}
            </Text>
          </HStack>
          
          {syncProgress && syncProgress.total > 0 && (
            <Text fontSize="sm" color="blue.600">
              Sync: {syncProgress.completed}/{syncProgress.total}
            </Text>
          )}
        </HStack>
        
        {!networkStatus.isConnected && recentRegistrations.length > 0 && (
          <Box mt={2} p={2} bg="orange.50" borderRadius="md" borderColor="orange.200" borderWidth={1}>
            <Text fontSize="sm" color="orange.700">
              📦 {recentRegistrations.filter((r: LocalWeightRegistration) => r.sync_status === 'pending').length} registros pendientes de sincronización
            </Text>
          </Box>
        )}
      </Box>

      <Center flex={1}>
        <VStack space={6} alignItems="center">
          <Text fontSize="2xl" fontWeight="bold" textAlign="center">
            Registro de Pesos
          </Text>
          <Text fontSize="md" color="gray.600" textAlign="center">
            Selecciona cómo deseas registrar el peso de la caja
          </Text>
          
          <VStack space={4} width="100%">
            <Button
              size="lg"
              minH="60px"
              bg="blue.500"
              onPress={() => navigation.navigate('CameraScreen')}
              _text={{ fontSize: 'lg', fontWeight: 'bold' }}
            >
              📷 Capturar con Cámara
            </Button>
            
            <Button
              size="lg"
              minH="60px"
              variant="outline"
              borderColor="blue.500"
              onPress={() => navigation.navigate('ManualEntryScreen')}
              _text={{ color: 'blue.500', fontSize: 'lg', fontWeight: 'bold' }}
            >
              ✏️ Entrada Manual
            </Button>
          </VStack>
          
          {/* Recent Registrations Summary */}
          {recentRegistrations.length > 0 && (
            <Box mt={6} width="100%">
              <Text fontSize="md" fontWeight="semibold" mb={2}>
                Registros de Hoy: {recentRegistrations.length}
              </Text>
              <HStack space={4} justifyContent="space-around">
                <VStack alignItems="center">
                  <Text fontSize="sm" color="green.600" fontWeight="bold">
                    {recentRegistrations.filter((r: LocalWeightRegistration) => r.sync_status === 'synced').length}
                  </Text>
                  <Text fontSize="xs" color="gray.600">Sincronizados</Text>
                </VStack>
                <VStack alignItems="center">
                  <Text fontSize="sm" color="orange.600" fontWeight="bold">
                    {recentRegistrations.filter((r: LocalWeightRegistration) => r.sync_status === 'pending').length}
                  </Text>
                  <Text fontSize="xs" color="gray.600">Pendientes</Text>
                </VStack>
                <VStack alignItems="center">
                  <Text fontSize="sm" color="red.600" fontWeight="bold">
                    {recentRegistrations.filter((r: LocalWeightRegistration) => r.sync_status === 'failed').length}
                  </Text>
                  <Text fontSize="xs" color="gray.600">Fallidos</Text>
                </VStack>
              </HStack>
            </Box>
          )}
        </VStack>
      </Center>
    </Box>
  );
};

const ManualEntryScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { OfflineRegistrationForm } = require('../../components/registration/OfflineRegistrationForm');
  const capturedImage = route.params?.capturedImage;
  
  const handleRegistrationSuccess = (registrationId: string) => {
    navigation.navigate('ConfirmationScreen', { registrationId });
  };

  const handleCancel = () => {
    navigation.goBack();
  };
  
  return (
    <OfflineRegistrationForm
      capturedImage={capturedImage}
      onSuccess={handleRegistrationSuccess}
      onCancel={handleCancel}
    />
  );
};

const ConfirmationScreen: React.FC<{ navigation: any; route: any }> = ({ navigation, route }) => {
  const { Box, Text, Center, Button, VStack } = require('native-base');
  const registrationId = route.params?.registrationId;
  const { networkStatus } = useOfflineStore();
  
  return (
    <Box flex={1} bg="white" p={6}>
      <Center flex={1}>
        <VStack space={6} alignItems="center">
          <Text fontSize="6xl">✅</Text>
          
          <Text fontSize="2xl" fontWeight="bold" textAlign="center">
            Registro Exitoso
          </Text>
          
          {registrationId && (
            <Text fontSize="md" color="gray.600" textAlign="center">
              ID: {registrationId.slice(0, 8)}...
            </Text>
          )}
          
          <Text fontSize="lg" textAlign="center" color={networkStatus.isConnected ? "green.600" : "orange.600"}>
            {networkStatus.isConnected 
              ? "✓ Sincronizado con el servidor"
              : "📡 Guardado localmente - Se sincronizará cuando haya conexión"
            }
          </Text>
          
          <Button
            size="lg"
            minH="60px"
            bg="blue.500"
            onPress={() => navigation.navigate('RegistrationHomeScreen')}
            _text={{ fontSize: 'lg', fontWeight: 'bold' }}
          >
            Nuevo Registro
          </Button>
        </VStack>
      </Center>
    </Box>
  );
};

export type RegistrationStackParamList = {
  RegistrationHomeScreen: undefined;
  CameraScreen: undefined;
  ManualEntryScreen: { capturedImage?: CapturedImage };
  ConfirmationScreen: { registrationId?: string };
  SyncStatusScreen: undefined;
};

const Stack = createNativeStackNavigator<RegistrationStackParamList>();

export const RegistrationNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="RegistrationHomeScreen"
      screenOptions={({ navigation }) => ({
        headerShown: true,
        headerStyle: {
          backgroundColor: '#2563EB',
        },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: {
          fontWeight: 'bold',
          fontSize: 18,
        },
        headerRight: () => (
          <SyncStatusCounter 
            onPress={() => navigation.navigate('SyncStatusScreen')}
          />
        ),
      })}
    >
      <Stack.Screen 
        name="RegistrationHomeScreen" 
        component={RegistrationHomeScreen}
        options={{ title: 'Registro de Pesos' }}
      />
      
      <Stack.Screen 
        name="CameraScreen" 
        component={CameraScreen}
        options={{ 
          title: 'Capturar Foto',
          headerShown: false, // Camera needs full screen
        }}
      />
      
      <Stack.Screen 
        name="ManualEntryScreen" 
        component={ManualEntryScreen}
        options={{ title: 'Entrada Manual' }}
      />
      
      <Stack.Screen 
        name="ConfirmationScreen" 
        component={ConfirmationScreen}
        options={{ title: 'Confirmación' }}
      />
      
      <Stack.Screen 
        name="SyncStatusScreen" 
        component={SyncStatusScreen}
        options={{ 
          title: 'Estado de Sincronización',
          headerRight: undefined, // Don't show sync counter on its own screen
        }}
      />
    </Stack.Navigator>
  );
};