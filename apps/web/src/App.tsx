import { useEffect, useState } from 'react';
import { useAuthStore } from './stores/auth-store';
import { LoginScreen } from './screens/LoginScreen';
import { Layout } from './components/Layout';
import { DashboardScreen } from './screens/DashboardScreen';
import { RegistrationsListScreen } from './screens/RegistrationsListScreen';
import { ManualRegistrationScreen } from './screens/ManualRegistrationScreen';
import { ImageUploadScreen } from './screens/ImageUploadScreen';
import { CameraScanScreen } from './screens/CameraScanScreen';

function App() {
  const { isAuthenticated, initializeSession, isLoading, isSupervisor } = useAuthStore();
  const [currentView, setCurrentView] = useState('dashboard');

  useEffect(() => {
    // Initialize session on app start
    initializeSession();
  }, [initializeSession]);

  useEffect(() => {
    // Set default view based on user role
    if (isAuthenticated) {
      if (isSupervisor()) {
        setCurrentView('dashboard');
      } else {
        setCurrentView('scan'); // Operators start with camera scan
      }
    }
  }, [isAuthenticated, isSupervisor]);

  // Show loading state while initializing
  if (isLoading) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, sans-serif'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #2563eb',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: '#6b7280', margin: 0 }}>Cargando...</p>
        </div>
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  // Render current view
  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <DashboardScreen />;
      case 'list':
        return <RegistrationsListScreen />;
      case 'register':
        return <ManualRegistrationScreen />;
      case 'upload':
        return <ImageUploadScreen />;
      case 'scan':
        return <CameraScanScreen />;
      default:
        return <DashboardScreen />;
    }
  };

  // Main app with layout
  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {renderCurrentView()}
    </Layout>
  );
}

export default App;
