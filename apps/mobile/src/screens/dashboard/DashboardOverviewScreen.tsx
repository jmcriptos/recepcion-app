/**
 * Dashboard Overview Screen
 * Real-time metrics and statistics for supervisors
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '@stores/auth-store';
import { IndustrialButton } from '@components/industrial/IndustrialButton';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';

interface DashboardStats {
  date: string;
  total_boxes_today: number;
  total_weight_today: number;
  registrations_by_supplier: Array<{
    supplier: string;
    count: number;
    total_weight: number;
  }>;
  registrations_by_user: Array<{
    user_name: string;
    user_role: string;
    count: number;
    total_weight: number;
  }>;
  registrations_by_cut_type: Array<{
    cut_type: string;
    count: number;
    total_weight: number;
  }>;
  recent_registrations: Array<{
    id: string;
    weight: number;
    cut_type: string;
    supplier: string;
    created_at: string;
  }>;
  hourly_stats: Array<{
    hour: number;
    count: number;
  }>;
  last_updated: string;
}

export const DashboardOverviewScreen: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { canAccessDashboard } = useAuthStore();

  const fetchDashboardStats = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/dashboard', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('No tienes permisos para acceder al dashboard');
        }
        throw new Error('Error al cargar las estadísticas del dashboard');
      }

      const data = await response.json();
      setStats(data);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching dashboard stats:', err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardStats(true);
  }, [fetchDashboardStats]);

  useEffect(() => {
    if (!canAccessDashboard()) {
      setError('No tienes permisos para acceder al dashboard');
      setLoading(false);
      return;
    }

    fetchDashboardStats();
  }, [canAccessDashboard, fetchDashboardStats]);

  if (loading) {
    return <LoadingState message="Cargando estadísticas..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => fetchDashboardStats()}
      />
    );
  }

  if (!stats) {
    return (
      <ErrorState
        message="No se pudieron cargar las estadísticas"
        onRetry={() => fetchDashboardStats()}
      />
    );
  }

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }
    >
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard - Supervisor</Text>
        <Text style={styles.subtitle}>
          Última actualización: {formatTime(stats.last_updated)}
        </Text>
      </View>

      {/* Today's Summary */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Resumen de Hoy</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>{stats.total_boxes_today}</Text>
            <Text style={styles.summaryLabel}>Cajas</Text>
          </View>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryNumber}>
              {stats.total_weight_today.toFixed(1)}
            </Text>
            <Text style={styles.summaryLabel}>kg Total</Text>
          </View>
        </View>
      </View>

      {/* By Cut Type */}
      {stats.registrations_by_cut_type.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Por Tipo de Corte</Text>
          {stats.registrations_by_cut_type.map((item) => (
            <View key={item.cut_type} style={styles.dataRow}>
              <Text style={styles.dataLabel}>{item.cut_type}</Text>
              <View style={styles.dataValues}>
                <Text style={styles.dataValue}>{item.count} cajas</Text>
                <Text style={styles.dataValue}>{item.total_weight.toFixed(1)} kg</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* By User */}
      {stats.registrations_by_user.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Por Usuario</Text>
          {stats.registrations_by_user.map((item) => (
            <View key={item.user_name} style={styles.dataRow}>
              <View>
                <Text style={styles.dataLabel}>{item.user_name}</Text>
                <Text style={styles.dataSubLabel}>({item.user_role})</Text>
              </View>
              <View style={styles.dataValues}>
                <Text style={styles.dataValue}>{item.count} cajas</Text>
                <Text style={styles.dataValue}>{item.total_weight.toFixed(1)} kg</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Top Suppliers */}
      {stats.registrations_by_supplier.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Principales Proveedores</Text>
          {stats.registrations_by_supplier.slice(0, 5).map((item) => (
            <View key={item.supplier} style={styles.dataRow}>
              <Text style={styles.dataLabel} numberOfLines={2}>
                {item.supplier}
              </Text>
              <View style={styles.dataValues}>
                <Text style={styles.dataValue}>{item.count} cajas</Text>
                <Text style={styles.dataValue}>{item.total_weight.toFixed(1)} kg</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Recent Registrations */}
      {stats.recent_registrations.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Registros Recientes</Text>
          {stats.recent_registrations.slice(0, 5).map((item) => (
            <View key={item.id} style={styles.dataRow}>
              <View style={styles.recentInfo}>
                <Text style={styles.dataLabel}>
                  {item.weight}kg - {item.cut_type}
                </Text>
                <Text style={styles.dataSubLabel} numberOfLines={1}>
                  {item.supplier}
                </Text>
              </View>
              <Text style={styles.dataValue}>
                {formatTime(item.created_at)}
              </Text>
            </View>
          ))}
        </View>
      )}

      <View style={styles.refreshSection}>
        <IndustrialButton
          title="Actualizar Datos"
          onPress={handleRefresh}
          disabled={refreshing}
        />
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700', // Bold typography for industrial UI
    color: '#1E293B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
  },
  section: {
    marginTop: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryCard: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#EFF6FF',
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  summaryNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2563EB',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    minHeight: 60, // Large touch target for industrial UI
  },
  dataLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  dataSubLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  dataValues: {
    alignItems: 'flex-end',
  },
  dataValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
  },
  recentInfo: {
    flex: 1,
  },
  refreshSection: {
    padding: 20,
    paddingBottom: 40,
  },
  refreshButton: {
    backgroundColor: '#2563EB',
  },
});

export default DashboardOverviewScreen;