/**
 * Main App Component
 * Handles session initialization and authentication flow
 */

import React, { useEffect } from 'react';
import { NativeBaseProvider } from 'native-base';
import { useAuthStore } from '@stores/auth-store';
import { LoginScreen } from '@screens/auth/LoginScreen';
import { LoadingState } from '@components/common/LoadingState';
import { SessionWarningDialog } from '@components/auth/SessionWarningDialog';
import { AppNavigator } from '../navigation/AppNavigator';

export const App: React.FC = () => {
  const {
    user,
    isAuthenticated,
    isLoading,
    sessionWarning,
    initializeSession,
    extendSession,
    logout,
    dismissSessionWarning,
  } = useAuthStore();

  useEffect(() => {
    // Initialize session on app start
    initializeSession();
  }, [initializeSession]);

  const handleExtendSession = async () => {
    try {
      await extendSession();
    } catch (error) {
      console.error('Error extending session:', error);
      // Error is handled by the store
    }
  };

  const handleLogoutFromWarning = async () => {
    dismissSessionWarning();
    await logout();
  };

  if (isLoading) {
    return (
      <NativeBaseProvider>
        <LoadingState 
          message="Inicializando aplicación..." 
          size="large"
        />
      </NativeBaseProvider>
    );
  }

  return (
    <NativeBaseProvider>
      {isAuthenticated && user ? (
        <>
          <AppNavigator />
          
          {/* Session Warning Dialog */}
          <SessionWarningDialog
            isOpen={sessionWarning.show}
            remainingTime={sessionWarning.remainingTime}
            onExtend={handleExtendSession}
            onLogout={handleLogoutFromWarning}
          />
        </>
      ) : (
        <LoginScreen />
      )}
    </NativeBaseProvider>
  );
};