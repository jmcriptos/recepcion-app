/**
 * Manual Registration Screen
 * Optimized form for web with keyboard shortcuts and validation
 */

import React, { useState, useEffect, useRef } from 'react';
import { useRegistrationStore } from '../stores/registration-store';
import { useAuthStore } from '../stores/auth-store';

export const ManualRegistrationScreen: React.FC = () => {
  const { user } = useAuthStore();
  const { 
    formData, 
    errors, 
    isSubmitting,
    setFormData, 
    setFieldError,
    submitRegistration,
    resetForm 
  } = useRegistrationStore();

  const [showSuccess, setShowSuccess] = useState(false);
  const [lastRegistration, setLastRegistration] = useState<any>(null);
  const [supplierSuggestions, setSupplierSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Refs for keyboard navigation
  const weightRef = useRef<HTMLInputElement>(null);
  const cutTypeRef = useRef<HTMLSelectElement>(null);
  const supplierRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);

  // Mock supplier data (in real app, this would come from API)
  const allSuppliers = [
    'Cárnicas del Norte',
    'Distribuidora La Montaña',
    'Frigorífico Central',
    'Proveedor ABC',
    'Carnes Premium',
    'Distribuciones XYZ'
  ];

  useEffect(() => {
    // Focus weight field on mount
    if (weightRef.current) {
      weightRef.current.focus();
    }

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl/Cmd + N: New registration
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNewRegistration();
      }
      // Ctrl/Cmd + S: Submit form
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    // Update supplier suggestions based on input
    if (formData.supplier) {
      const filtered = allSuppliers.filter(supplier =>
        supplier.toLowerCase().includes(formData.supplier.toLowerCase())
      );
      setSupplierSuggestions(filtered);
    } else {
      setSupplierSuggestions(allSuppliers);
    }
  }, [formData.supplier]);

  const handleInputChange = (field: string, value: string) => {
    setFormData({ [field]: value });
    
    // Real-time validation
    if (field === 'weight' && value) {
      const weight = parseFloat(value);
      if (isNaN(weight) || weight <= 0) {
        setFieldError('weight', 'El peso debe ser un número válido mayor a 0');
      } else if (weight < 0.1 || weight > 50) {
        setFieldError('weight', 'El peso debe estar entre 0.1 y 50 kg');
      } else {
        setFieldError('weight', null);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, nextRef?: React.RefObject<HTMLElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef?.current) {
        nextRef.current.focus();
      }
    }
  };

  const handleSupplierSelect = (supplier: string) => {
    setFormData({ supplier });
    setShowSuggestions(false);
    if (submitRef.current) {
      submitRef.current.focus();
    }
  };

  const handleSubmit = async () => {
    if (!user) return;
    
    try {
      const registration = await submitRegistration(user.id);
      setLastRegistration(registration);
      setShowSuccess(true);
      
      // Auto-hide success message and focus weight field
      setTimeout(() => {
        setShowSuccess(false);
        if (weightRef.current) {
          weightRef.current.focus();
        }
      }, 3000);
    } catch (error) {
      console.error('Registration failed:', error);
    }
  };

  const handleNewRegistration = () => {
    resetForm();
    setShowSuccess(false);
    setLastRegistration(null);
    if (weightRef.current) {
      weightRef.current.focus();
    }
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ marginBottom: '32px' }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: 'bold',
          color: '#111827',
          margin: '0 0 8px 0'
        }}>
          Nuevo Registro Manual
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Registra el peso de la caja de carne manualmente
        </p>
        <div style={{ 
          marginTop: '8px', 
          fontSize: '12px', 
          color: '#9ca3af',
          display: 'flex',
          gap: '16px'
        }}>
          <span>💡 <kbd>Ctrl+N</kbd> Nuevo registro</span>
          <span>💡 <kbd>Ctrl+S</kbd> Guardar</span>
          <span>💡 <kbd>Enter</kbd> Siguiente campo</span>
        </div>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 400px',
        gap: '32px'
      }}>
        
        {/* Main Form */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '32px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          
          {/* Success Message */}
          {showSuccess && lastRegistration && (
            <div style={{
              backgroundColor: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '24px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{ fontSize: '24px' }}>✅</span>
              <div>
                <p style={{ 
                  fontWeight: '600', 
                  color: '#166534', 
                  margin: '0 0 4px 0' 
                }}>
                  ¡Registro guardado exitosamente!
                </p>
                <p style={{ 
                  fontSize: '14px', 
                  color: '#16a34a', 
                  margin: 0 
                }}>
                  {lastRegistration.weight} kg de {lastRegistration.cut_type} - {lastRegistration.supplier}
                </p>
              </div>
            </div>
          )}

          <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
            
            {/* Weight Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Peso (kg) <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                ref={weightRef}
                type="number"
                step="0.01"
                min="0.1"
                max="50"
                value={formData.weight}
                onChange={(e) => handleInputChange('weight', e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, cutTypeRef)}
                placeholder="Ej: 15.5"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${errors.weight ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: errors.weight ? '#fef2f2' : 'white',
                  boxSizing: 'border-box'
                }}
              />
              {errors.weight && (
                <p style={{ 
                  color: '#dc2626', 
                  fontSize: '14px', 
                  margin: '8px 0 0 0' 
                }}>
                  {errors.weight}
                </p>
              )}
            </div>

            {/* Cut Type Field */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Tipo de Corte <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <select
                ref={cutTypeRef}
                value={formData.cut_type}
                onChange={(e) => handleInputChange('cut_type', e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, supplierRef)}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${errors.cut_type ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: errors.cut_type ? '#fef2f2' : 'white',
                  boxSizing: 'border-box'
                }}
              >
                <option value="">Selecciona el tipo de corte</option>
                <option value="jamón">Jamón</option>
                <option value="chuleta">Chuleta</option>
              </select>
              {errors.cut_type && (
                <p style={{ 
                  color: '#dc2626', 
                  fontSize: '14px', 
                  margin: '8px 0 0 0' 
                }}>
                  {errors.cut_type}
                </p>
              )}
            </div>

            {/* Supplier Field with Autocomplete */}
            <div style={{ marginBottom: '32px', position: 'relative' }}>
              <label style={{
                display: 'block',
                fontSize: '14px',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '8px'
              }}>
                Proveedor <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <input
                ref={supplierRef}
                type="text"
                value={formData.supplier}
                onChange={(e) => handleInputChange('supplier', e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                onKeyPress={(e) => handleKeyPress(e, submitRef)}
                placeholder="Ingresa o selecciona el proveedor"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: `1px solid ${errors.supplier ? '#dc2626' : '#d1d5db'}`,
                  borderRadius: '8px',
                  fontSize: '16px',
                  backgroundColor: errors.supplier ? '#fef2f2' : 'white',
                  boxSizing: 'border-box'
                }}
              />
              
              {/* Supplier Suggestions */}
              {showSuggestions && supplierSuggestions.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  backgroundColor: 'white',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  zIndex: 10
                }}>
                  {supplierSuggestions.slice(0, 6).map((supplier, index) => (
                    <button
                      key={index}
                      type="button"
                      onMouseDown={() => handleSupplierSelect(supplier)}
                      style={{
                        width: '100%',
                        padding: '12px 16px',
                        textAlign: 'left',
                        border: 'none',
                        backgroundColor: 'white',
                        cursor: 'pointer',
                        fontSize: '14px',
                        borderBottom: index < supplierSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
                    >
                      {supplier}
                    </button>
                  ))}
                </div>
              )}
              
              {errors.supplier && (
                <p style={{ 
                  color: '#dc2626', 
                  fontSize: '14px', 
                  margin: '8px 0 0 0' 
                }}>
                  {errors.supplier}
                </p>
              )}
            </div>

            {/* Submit Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                ref={submitRef}
                type="submit"
                disabled={isSubmitting}
                style={{
                  flex: 1,
                  padding: '14px 24px',
                  backgroundColor: isSubmitting ? '#9ca3af' : '#2563eb',
                  color: 'white',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                {isSubmitting ? (
                  <>
                    <div style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid #ffffff40',
                      borderTop: '2px solid #ffffff',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite'
                    }} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <span>💾</span>
                    Guardar Registro
                  </>
                )}
              </button>
              
              <button
                type="button"
                onClick={handleNewRegistration}
                disabled={isSubmitting}
                style={{
                  padding: '14px 24px',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontWeight: '600',
                  borderRadius: '8px',
                  border: '1px solid #d1d5db',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <span>🔄</span>
                Limpiar
              </button>
            </div>
          </form>

          <style>
            {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
          </style>
        </div>

        {/* Quick Stats Sidebar */}
        <div>
          <div style={{
            backgroundColor: 'white',
            borderRadius: '8px',
            padding: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            marginBottom: '24px'
          }}>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: '#111827',
              margin: '0 0 16px 0'
            }}>
              Registro Actual
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Usuario:</span>
                <span style={{ fontWeight: '600', color: '#111827' }}>{user?.name}</span>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Peso:</span>
                <span style={{ fontWeight: '600', color: formData.weight ? '#2563eb' : '#9ca3af' }}>
                  {formData.weight || '—'} {formData.weight ? 'kg' : ''}
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: '1px solid #f3f4f6'
              }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Tipo:</span>
                <span style={{ fontWeight: '600', color: formData.cut_type ? '#2563eb' : '#9ca3af' }}>
                  {formData.cut_type || '—'}
                </span>
              </div>
              
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 0'
              }}>
                <span style={{ color: '#6b7280', fontSize: '14px' }}>Proveedor:</span>
                <span style={{ 
                  fontWeight: '600', 
                  color: formData.supplier ? '#2563eb' : '#9ca3af',
                  maxWidth: '150px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {formData.supplier || '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Quick Tips */}
          <div style={{
            backgroundColor: '#eff6ff',
            borderRadius: '8px',
            padding: '20px',
            border: '1px solid #dbeafe'
          }}>
            <h4 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: '#1e40af',
              margin: '0 0 12px 0'
            }}>
              💡 Consejos Rápidos
            </h4>
            <ul style={{ 
              margin: 0, 
              paddingLeft: '20px',
              color: '#1e40af',
              fontSize: '14px',
              lineHeight: '1.6'
            }}>
              <li>Use <kbd style={{ backgroundColor: 'white', padding: '2px 4px', borderRadius: '3px' }}>Tab</kbd> para navegar entre campos</li>
              <li>El autocompletado sugiere proveedores existentes</li>
              <li>Los pesos válidos van de 0.1 a 50 kg</li>
              <li>Presione <kbd style={{ backgroundColor: 'white', padding: '2px 4px', borderRadius: '3px' }}>Ctrl+S</kbd> para guardar rápidamente</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};