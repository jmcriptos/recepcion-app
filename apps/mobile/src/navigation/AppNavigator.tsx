import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RegistrationNavigator } from './RegistrationNavigator';
import { DashboardOverviewScreen } from '../screens/dashboard/DashboardOverviewScreen';
import { UserManagementScreen } from '../screens/dashboard/UserManagementScreen';
import { useAuthStore } from '../stores/auth-store';

export type RootStackParamList = {
  RegistrationTab: undefined;
  Dashboard: undefined;
  UserManagement: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export const AppNavigator: React.FC = () => {
  const { user, canAccessDashboard, canManageUsers } = useAuthStore();

  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="RegistrationTab"
        screenOptions={{
          headerShown: false, // We'll handle headers in individual screens
        }}
      >
        {/* Registration Tab - Always available */}
        <Stack.Screen 
          name="RegistrationTab" 
          component={RegistrationNavigator}
          options={{ title: 'Registro' }}
        />
        
        {/* Supervisor-only screens */}
        {canAccessDashboard() && (
          <Stack.Screen 
            name="Dashboard" 
            component={DashboardOverviewScreen}
            options={{ title: 'Dashboard' }}
          />
        )}
        
        {canManageUsers() && (
          <Stack.Screen 
            name="UserManagement" 
            component={UserManagementScreen}
            options={{ title: 'Gestión de Usuarios' }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};