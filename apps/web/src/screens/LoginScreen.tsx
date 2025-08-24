/**
 * Login Screen - Web Version
 * Simple login interface for web app
 */

import React, { useState } from 'react';
import { useAuthStore } from '../stores/auth-store';

export const LoginScreen: React.FC = () => {
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState('');
  
  const { 
    login, 
    isLoading, 
    error, 
    clearError,
    user,
    isAuthenticated 
  } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError('');
    
    if (!name.trim()) {
      setLocalError('Por favor ingresa tu nombre');
      return;
    }

    try {
      await login(name.trim());
    } catch (err) {
      // Error is handled by the store
      console.error('Login error:', err);
    }
  };

  const handleClearError = () => {
    clearError();
    setLocalError('');
  };

  // Mock users for testing
  const mockUsers = [
    'Juan Pérez (Operador)',
    'María García (Operador)', 
    'Carlos Supervisor',
    'Ana Supervisor'
  ];

  if (isAuthenticated && user) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        padding: '32px 16px',
        fontFamily: 'system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          padding: '32px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center'
        }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '60px',
              height: '60px',
              backgroundColor: '#059669',
              borderRadius: '50%',
              marginBottom: '16px'
            }}>
              <span style={{ fontSize: '24px' }}>✅</span>
            </div>
            <h2 style={{ 
              fontSize: '24px', 
              fontWeight: 'bold', 
              color: '#059669',
              margin: '0 0 8px 0'
            }}>
              ¡Bienvenido!
            </h2>
            <p style={{ color: '#4b5563', margin: 0 }}>
              Sesión iniciada correctamente
            </p>
          </div>

          <div style={{
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            padding: '16px',
            marginBottom: '24px',
            textAlign: 'left'
          }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#374151' }}>
              Usuario: {user.name}
            </p>
            <p style={{ margin: '0 0 8px 0', color: '#6b7280' }}>
              Rol: {user.role === 'supervisor' ? 'Supervisor' : 'Operador'}
            </p>
            <p style={{ margin: 0, color: '#6b7280', fontSize: '14px' }}>
              ID: {user.id}
            </p>
          </div>

          <button
            onClick={() => useAuthStore.getState().logout()}
            style={{
              backgroundColor: '#dc2626',
              color: 'white',
              fontWeight: '600',
              padding: '12px 24px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              width: '100%',
              fontSize: '16px',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#b91c1c'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      padding: '32px 16px',
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        padding: '32px',
        maxWidth: '450px',
        width: '100%'
      }}>
        
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '60px',
            height: '60px',
            backgroundColor: '#2563eb',
            borderRadius: '50%',
            marginBottom: '16px'
          }}>
            <span style={{ fontSize: '24px' }}>🥩</span>
          </div>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: '#111827',
            margin: '0 0 8px 0'
          }}>
            Iniciar Sesión
          </h1>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Aplicación de Registro de Pesos
          </p>
        </div>

        {/* Error messages */}
        {(error || localError) && (
          <div style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '6px',
            padding: '12px',
            marginBottom: '24px'
          }}>
            <p style={{ 
              color: '#dc2626', 
              margin: 0, 
              fontSize: '14px' 
            }}>
              {error || localError}
            </p>
            <button
              onClick={handleClearError}
              style={{
                color: '#dc2626',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
                textDecoration: 'underline',
                marginTop: '4px'
              }}
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Login form */}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Nombre del Usuario
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ingresa tu nombre completo"
              disabled={isLoading}
              style={{
                width: '100%',
                padding: '12px 16px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '16px',
                backgroundColor: isLoading ? '#f9fafb' : 'white',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '12px 24px',
              backgroundColor: isLoading ? '#9ca3af' : '#2563eb',
              color: 'white',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '16px',
              transition: 'background-color 0.2s'
            }}
          >
            {isLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        {/* Mock users for testing */}
        <div style={{ 
          marginTop: '24px', 
          padding: '16px', 
          backgroundColor: '#f9fafb', 
          borderRadius: '6px' 
        }}>
          <p style={{ 
            fontSize: '12px', 
            color: '#6b7280', 
            margin: '0 0 8px 0',
            fontWeight: '600'
          }}>
            Usuarios de prueba:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
            {mockUsers.map((user, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setName(user)}
                disabled={isLoading}
                style={{
                  fontSize: '11px',
                  padding: '4px 8px',
                  backgroundColor: 'white',
                  border: '1px solid #e5e7eb',
                  borderRadius: '4px',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  color: '#4b5563'
                }}
              >
                {user}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};