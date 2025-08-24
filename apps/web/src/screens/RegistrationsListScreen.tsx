/**
 * Registrations List Screen
 * Display and filter weight registrations
 */

import React, { useState, useEffect } from 'react';
import { useRegistrationStore } from '../stores/registration-store';

interface Filters {
  supplier: string;
  cut_type: string;
  date_from: string;
  date_to: string;
}

export const RegistrationsListScreen: React.FC = () => {
  const { recentRegistrations, loadRecentRegistrations, isLoadingRecent } = useRegistrationStore();
  const [filters, setFilters] = useState<Filters>({
    supplier: '',
    cut_type: '',
    date_from: '',
    date_to: ''
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    loadRecentRegistrations();
  }, [loadRecentRegistrations]);

  // Filter and search logic
  const filteredRegistrations = recentRegistrations.filter(reg => {
    const matchesSearch = searchTerm === '' || 
      reg.supplier.toLowerCase().includes(searchTerm.toLowerCase()) ||
      reg.registered_by.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesSupplier = filters.supplier === '' || 
      reg.supplier.toLowerCase().includes(filters.supplier.toLowerCase());
    
    const matchesCutType = filters.cut_type === '' || reg.cut_type === filters.cut_type;

    return matchesSearch && matchesSupplier && matchesCutType;
  });

  // Pagination logic
  const totalPages = Math.ceil(filteredRegistrations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRegistrations = filteredRegistrations.slice(startIndex, startIndex + itemsPerPage);

  const handleFilterChange = (field: keyof Filters, value: string) => {
    setFilters(prev => ({ ...prev, [field]: value }));
    setCurrentPage(1); // Reset to first page when filtering
  };

  const clearFilters = () => {
    setFilters({
      supplier: '',
      cut_type: '',
      date_from: '',
      date_to: ''
    });
    setSearchTerm('');
    setCurrentPage(1);
  };

  const exportToCSV = () => {
    if (filteredRegistrations.length === 0) return;

    const headers = ['Peso (kg)', 'Tipo de Corte', 'Proveedor', 'Registrado Por', 'Fecha'];
    const csvContent = [
      headers.join(','),
      ...filteredRegistrations.map(reg => [
        reg.weight,
        reg.cut_type,
        `"${reg.supplier}"`,
        `"${reg.registered_by}"`,
        new Date(reg.created_at).toLocaleString('es-ES')
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `registros_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'start',
        marginBottom: '32px' 
      }}>
        <div>
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#111827',
            margin: '0 0 8px 0'
          }}>
            Lista de Registros
          </h2>
          <p style={{ color: '#6b7280', margin: 0 }}>
            {filteredRegistrations.length} registro{filteredRegistrations.length !== 1 ? 's' : ''} encontrado{filteredRegistrations.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <button
          onClick={exportToCSV}
          disabled={filteredRegistrations.length === 0}
          style={{
            backgroundColor: filteredRegistrations.length > 0 ? '#059669' : '#9ca3af',
            color: 'white',
            padding: '12px 24px',
            borderRadius: '8px',
            border: 'none',
            cursor: filteredRegistrations.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <span>📊</span>
          Exportar CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        padding: '24px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        marginBottom: '24px'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#111827',
          margin: '0 0 16px 0'
        }}>
          Filtros y Búsqueda
        </h3>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '16px'
        }}>
          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Búsqueda General
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por proveedor o usuario..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Proveedor
            </label>
            <input
              type="text"
              value={filters.supplier}
              onChange={(e) => handleFilterChange('supplier', e.target.value)}
              placeholder="Filtrar por proveedor..."
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div>
            <label style={{
              display: 'block',
              fontSize: '14px',
              fontWeight: '600',
              color: '#374151',
              marginBottom: '8px'
            }}>
              Tipo de Corte
            </label>
            <select
              value={filters.cut_type}
              onChange={(e) => handleFilterChange('cut_type', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }}
            >
              <option value="">Todos los tipos</option>
              <option value="jamón">Jamón</option>
              <option value="chuleta">Chuleta</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={clearFilters}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Limpiar Filtros
          </button>
          <button
            onClick={loadRecentRegistrations}
            disabled={isLoadingRecent}
            style={{
              backgroundColor: '#2563eb',
              color: 'white',
              padding: '8px 16px',
              borderRadius: '6px',
              border: 'none',
              cursor: isLoadingRecent ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isLoadingRecent ? 'Actualizando...' : 'Actualizar'}
          </button>
        </div>
      </div>

      {/* Results Table */}
      <div style={{
        backgroundColor: 'white',
        borderRadius: '8px',
        border: '1px solid #e5e7eb',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        overflow: 'hidden'
      }}>
        {isLoadingRecent ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            minHeight: '200px' 
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
              <p style={{ color: '#6b7280' }}>Cargando registros...</p>
            </div>
            <style>
              {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
            </style>
          </div>
        ) : paginatedRegistrations.length > 0 ? (
          <>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9fafb' }}>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Peso
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Tipo
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Proveedor
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Registrado Por
                    </th>
                    <th style={{
                      padding: '12px 16px',
                      textAlign: 'left',
                      fontSize: '12px',
                      fontWeight: '600',
                      color: '#374151',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Fecha
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRegistrations.map((reg, index) => (
                    <tr key={reg.id} style={{
                      borderTop: index > 0 ? '1px solid #f3f4f6' : 'none'
                    }}>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: '#2563eb'
                      }}>
                        {reg.weight} kg
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#374151'
                      }}>
                        <span style={{
                          backgroundColor: reg.cut_type === 'jamón' ? '#fef3c7' : '#dbeafe',
                          color: reg.cut_type === 'jamón' ? '#92400e' : '#1e40af',
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500'
                        }}>
                          {reg.cut_type}
                        </span>
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#374151',
                        fontWeight: '500'
                      }}>
                        {reg.supplier}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        {reg.registered_by}
                      </td>
                      <td style={{
                        padding: '16px',
                        fontSize: '14px',
                        color: '#6b7280'
                      }}>
                        {new Date(reg.created_at).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{
                display: 'flex',
                justifyContent: 'between',
                alignItems: 'center',
                padding: '16px 24px',
                borderTop: '1px solid #f3f4f6',
                backgroundColor: '#f9fafb'
              }}>
                <p style={{ color: '#6b7280', fontSize: '14px', margin: 0 }}>
                  Mostrando {startIndex + 1} - {Math.min(startIndex + itemsPerPage, filteredRegistrations.length)} de {filteredRegistrations.length}
                </p>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === 1 ? '#f3f4f6' : '#2563eb',
                      color: currentPage === 1 ? '#9ca3af' : 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Anterior
                  </button>
                  <span style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 16px',
                    fontSize: '14px',
                    color: '#374151'
                  }}>
                    {currentPage} de {totalPages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    style={{
                      padding: '8px 12px',
                      backgroundColor: currentPage === totalPages ? '#f3f4f6' : '#2563eb',
                      color: currentPage === totalPages ? '#9ca3af' : 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ 
            textAlign: 'center', 
            padding: '64px 24px',
            color: '#6b7280' 
          }}>
            <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📋</span>
            <h3 style={{ 
              fontSize: '18px', 
              fontWeight: '600', 
              margin: '0 0 8px 0',
              color: '#374151' 
            }}>
              No se encontraron registros
            </h3>
            <p style={{ margin: 0 }}>
              {searchTerm || filters.supplier || filters.cut_type ? 
                'Intenta ajustar los filtros de búsqueda' : 
                'Aún no hay registros de peso disponibles'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
};