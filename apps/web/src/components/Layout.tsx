/**
 * Main Layout Component
 * Navigation and layout wrapper for authenticated users
 */

import React from 'react';
import { useAuthStore } from '../stores/auth-store';

interface LayoutProps {
  children: React.ReactNode;
  currentView: string;
  onNavigate: (view: string) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  const { user, logout, isSupervisor } = useAuthStore();

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', supervisorOnly: true },
    { id: 'scan', label: 'Escanear Cámara', icon: '📱', supervisorOnly: false },
    { id: 'register', label: 'Nuevo Registro', icon: '➕', supervisorOnly: false },
    { id: 'list', label: 'Lista Registros', icon: '📋', supervisorOnly: false },
    { id: 'upload', label: 'Subir Imágenes', icon: '📸', supervisorOnly: false },
  ];

  const availableItems = menuItems.filter(item => !item.supervisorOnly || isSupervisor());

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb' }}>
      {/* Header */}
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        padding: '12px 24px'
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              backgroundColor: '#2563eb',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <span style={{ fontSize: '20px' }}>🥩</span>
            </div>
            <div>
              <h1 style={{ 
                margin: 0, 
                fontSize: '18px', 
                fontWeight: 'bold',
                color: '#111827'
              }}>
                Registro de Pesos
              </h1>
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                color: '#6b7280' 
              }}>
                Web Application
              </p>
            </div>
          </div>

          {/* User Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ 
                margin: 0, 
                fontSize: '14px', 
                fontWeight: '600',
                color: '#111827'
              }}>
                {user?.name}
              </p>
              <p style={{ 
                margin: 0, 
                fontSize: '12px', 
                color: '#6b7280' 
              }}>
                {user?.role === 'supervisor' ? 'Supervisor' : 'Operador'}
              </p>
            </div>
            <button
              onClick={logout}
              style={{
                backgroundColor: '#dc2626',
                color: 'white',
                padding: '8px 16px',
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <div style={{
        maxWidth: '1200px',
        margin: '0 auto',
        display: 'flex',
        minHeight: 'calc(100vh - 73px)'
      }}>
        {/* Sidebar */}
        <aside style={{
          width: '250px',
          backgroundColor: 'white',
          borderRight: '1px solid #e5e7eb',
          padding: '24px 16px'
        }}>
          <nav>
            <ul style={{ 
              listStyle: 'none', 
              padding: 0, 
              margin: 0 
            }}>
              {availableItems.map(item => (
                <li key={item.id} style={{ marginBottom: '4px' }}>
                  <button
                    onClick={() => onNavigate(item.id)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      backgroundColor: currentView === item.id ? '#eff6ff' : 'transparent',
                      border: currentView === item.id ? '1px solid #dbeafe' : '1px solid transparent',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      fontSize: '14px',
                      fontWeight: currentView === item.id ? '600' : '500',
                      color: currentView === item.id ? '#2563eb' : '#374151',
                      textAlign: 'left',
                      transition: 'all 0.2s'
                    }}
                    onMouseOver={(e) => {
                      if (currentView !== item.id) {
                        e.currentTarget.style.backgroundColor = '#f9fafb';
                      }
                    }}
                    onMouseOut={(e) => {
                      if (currentView !== item.id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    <span style={{ fontSize: '16px' }}>{item.icon}</span>
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main style={{
          flex: 1,
          padding: '24px'
        }}>
          {children}
        </main>
      </div>
    </div>
  );
};