/**
 * Dashboard Screen
 * Real-time metrics and overview for supervisors
 */

import React, { useState, useEffect } from 'react';
import { useRegistrationStore } from '../stores/registration-store';

interface DashboardStats {
  totalToday: number;
  totalWeight: number;
  averageWeight: number;
  supplierBreakdown: { supplier: string; count: number; weight: number }[];
  recentRegistrations: any[];
}

export const DashboardScreen: React.FC = () => {
  const { recentRegistrations, loadRecentRegistrations, isLoadingRecent } = useRegistrationStore();
  const [stats, setStats] = useState<DashboardStats>({
    totalToday: 0,
    totalWeight: 0,
    averageWeight: 0,
    supplierBreakdown: [],
    recentRegistrations: []
  });

  useEffect(() => {
    loadRecentRegistrations();
  }, [loadRecentRegistrations]);

  useEffect(() => {
    // Calculate stats from recent registrations
    if (recentRegistrations.length > 0) {
      const totalWeight = recentRegistrations.reduce((sum, reg) => sum + reg.weight, 0);
      const supplierMap = new Map();
      
      recentRegistrations.forEach(reg => {
        const existing = supplierMap.get(reg.supplier) || { count: 0, weight: 0 };
        supplierMap.set(reg.supplier, {
          count: existing.count + 1,
          weight: existing.weight + reg.weight
        });
      });

      const supplierBreakdown = Array.from(supplierMap.entries()).map(([supplier, data]) => ({
        supplier,
        ...data
      }));

      setStats({
        totalToday: recentRegistrations.length,
        totalWeight,
        averageWeight: totalWeight / recentRegistrations.length,
        supplierBreakdown,
        recentRegistrations: recentRegistrations.slice(0, 5)
      });
    }
  }, [recentRegistrations]);

  if (isLoadingRecent) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        minHeight: '400px' 
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
          <p style={{ color: '#6b7280' }}>Cargando dashboard...</p>
        </div>
        <style>
          {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
        </style>
      </div>
    );
  }

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
          Dashboard Supervisor
        </h2>
        <p style={{ color: '#6b7280', margin: 0 }}>
          Vista general de las operaciones del día
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '24px',
        marginBottom: '32px'
      }}>
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 4px 0' }}>
                Registros Hoy
              </p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                {stats.totalToday}
              </p>
            </div>
            <div style={{
              backgroundColor: '#eff6ff',
              padding: '8px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>📊</span>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 4px 0' }}>
                Peso Total
              </p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                {stats.totalWeight.toFixed(1)} kg
              </p>
            </div>
            <div style={{
              backgroundColor: '#f0fdf4',
              padding: '8px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>⚖️</span>
            </div>
          </div>
        </div>

        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
            <div>
              <p style={{ color: '#6b7280', fontSize: '14px', margin: '0 0 4px 0' }}>
                Peso Promedio
              </p>
              <p style={{ fontSize: '32px', fontWeight: 'bold', color: '#111827', margin: 0 }}>
                {stats.averageWeight ? stats.averageWeight.toFixed(1) : '0'} kg
              </p>
            </div>
            <div style={{
              backgroundColor: '#fefce8',
              padding: '8px',
              borderRadius: '8px'
            }}>
              <span style={{ fontSize: '24px' }}>📏</span>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {/* Supplier Breakdown */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0'
          }}>
            Breakdown por Proveedor
          </h3>
          
          {stats.supplierBreakdown.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {stats.supplierBreakdown.map((item, index) => (
                <div key={index} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px'
                }}>
                  <div>
                    <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                      {item.supplier}
                    </p>
                    <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                      {item.count} registro{item.count !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontWeight: '600', color: '#2563eb', margin: 0 }}>
                      {item.weight.toFixed(1)} kg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>
              No hay datos disponibles
            </p>
          )}
        </div>

        {/* Recent Activity */}
        <div style={{
          backgroundColor: 'white',
          borderRadius: '8px',
          padding: '24px',
          border: '1px solid #e5e7eb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: '#111827',
            margin: '0 0 16px 0'
          }}>
            Actividad Reciente
          </h3>
          
          {stats.recentRegistrations.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {stats.recentRegistrations.map((reg, index) => (
                <div key={index} style={{
                  padding: '12px',
                  borderLeft: '3px solid #2563eb',
                  backgroundColor: '#f9fafb',
                  borderRadius: '0 6px 6px 0'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div>
                      <p style={{ fontWeight: '600', color: '#111827', margin: '0 0 4px 0' }}>
                        {reg.weight} kg - {reg.cut_type}
                      </p>
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                        {reg.supplier} • {reg.registered_by}
                      </p>
                    </div>
                    <p style={{ fontSize: '11px', color: '#9ca3af' }}>
                      {new Date(reg.created_at).toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: '#6b7280', textAlign: 'center', padding: '32px 0' }}>
              No hay registros recientes
            </p>
          )}
        </div>
      </div>
    </div>
  );
};