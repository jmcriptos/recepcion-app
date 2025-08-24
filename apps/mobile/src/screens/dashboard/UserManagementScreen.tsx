/**
 * User Management Screen
 * Add, edit, and manage users (supervisors only)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { useAuthStore } from '@stores/auth-store';
import { IndustrialButton } from '@components/industrial/IndustrialButton';
import { LoadingState } from '@components/common/LoadingState';
import { ErrorState } from '@components/common/ErrorState';

interface User {
  id: string;
  name: string;
  role: 'operator' | 'supervisor';
  active: boolean;
  created_at: string;
  last_login: string | null;
}

interface UsersResponse {
  users: User[];
  total_count: number;
}

export const UserManagementScreen: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<'operator' | 'supervisor'>('operator');
  const [formActive, setFormActive] = useState(true);
  const [formLoading, setFormLoading] = useState(false);
  
  const { canManageUsers } = useAuthStore();

  const fetchUsers = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);

      const response = await fetch('/api/v1/users', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('No tienes permisos para gestionar usuarios');
        }
        throw new Error('Error al cargar los usuarios');
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      setError(errorMessage);
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchUsers(true);
  }, [fetchUsers]);

  const resetForm = () => {
    setFormName('');
    setFormRole('operator');
    setFormActive(true);
    setEditingUser(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (user: User) => {
    setFormName(user.name);
    setFormRole(user.role);
    setFormActive(user.active);
    setEditingUser(user);
    setShowAddModal(true);
  };

  const closeModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  const handleSaveUser = async () => {
    if (!formName.trim()) {
      Alert.alert('Error', 'El nombre es requerido');
      return;
    }

    try {
      setFormLoading(true);

      const url = editingUser ? `/api/v1/users/${editingUser.id}` : '/api/v1/users';
      const method = editingUser ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formName.trim(),
          role: formRole,
          active: formActive,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        if (response.status === 409) {
          throw new Error('Ya existe un usuario con este nombre');
        }
        throw new Error(errorData?.error?.message || 'Error al guardar el usuario');
      }

      const action = editingUser ? 'actualizado' : 'creado';
      Alert.alert('Éxito', `Usuario ${action} correctamente`);
      
      closeModal();
      fetchUsers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error', errorMessage);
      console.error('Error saving user:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const confirmToggleUserStatus = (user: User) => {
    const action = user.active ? 'desactivar' : 'activar';
    Alert.alert(
      'Confirmar acción',
      `¿Estás seguro de que quieres ${action} a ${user.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Confirmar', onPress: () => toggleUserStatus(user) },
      ]
    );
  };

  const toggleUserStatus = async (user: User) => {
    try {
      const response = await fetch(`/api/v1/users/${user.id}`, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          active: !user.active,
        }),
      });

      if (!response.ok) {
        throw new Error('Error al cambiar el estado del usuario');
      }

      fetchUsers();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
      Alert.alert('Error', errorMessage);
      console.error('Error toggling user status:', err);
    }
  };

  useEffect(() => {
    if (!canManageUsers()) {
      setError('No tienes permisos para gestionar usuarios');
      setLoading(false);
      return;
    }

    fetchUsers();
  }, [canManageUsers, fetchUsers]);

  if (loading) {
    return <LoadingState message="Cargando usuarios..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => fetchUsers()}
      />
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Gestión de Usuarios</Text>
        <IndustrialButton
          title="+ Agregar Usuario"
          onPress={openAddModal}
        />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {users.map((user) => (
          <View key={user.id} style={styles.userCard}>
            <View style={styles.userInfo}>
              <View style={styles.userHeader}>
                <Text style={styles.userName}>{user.name}</Text>
                <View style={[
                  styles.roleBadge,
                  user.role === 'supervisor' && styles.supervisorBadge,
                ]}>
                  <Text style={[
                    styles.roleText,
                    user.role === 'supervisor' && styles.supervisorText,
                  ]}>
                    {user.role === 'supervisor' ? 'Supervisor' : 'Operador'}
                  </Text>
                </View>
              </View>
              
              <View style={styles.userDetails}>
                <Text style={styles.userDetail}>
                  Creado: {formatDate(user.created_at)}
                </Text>
                {user.last_login && (
                  <Text style={styles.userDetail}>
                    Último acceso: {formatDate(user.last_login)}
                  </Text>
                )}
                <Text style={[
                  styles.userStatus,
                  user.active ? styles.activeStatus : styles.inactiveStatus,
                ]}>
                  {user.active ? 'Activo' : 'Inactivo'}
                </Text>
              </View>
            </View>

            <View style={styles.userActions}>
              <IndustrialButton
                title="Editar"
                onPress={() => openEditModal(user)}
              />
              <IndustrialButton
                title={user.active ? 'Desactivar' : 'Activar'}
                onPress={() => confirmToggleUserStatus(user)}
              />
            </View>
          </View>
        ))}

        {users.length === 0 && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No hay usuarios registrados</Text>
          </View>
        )}
      </ScrollView>

      {/* Add/Edit User Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingUser ? 'Editar Usuario' : 'Agregar Usuario'}
            </Text>
            <IndustrialButton
              title="Cancelar"
              onPress={closeModal}
            />
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Nombre *</Text>
              <TextInput
                style={styles.textInput}
                value={formName}
                onChangeText={setFormName}
                placeholder="Nombre completo del usuario"
                placeholderTextColor="#9CA3AF"
                autoCapitalize="words"
                maxLength={255}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Rol *</Text>
              <View style={styles.roleSelector}>
                <IndustrialButton
                  title="Operador"
                  onPress={() => setFormRole('operator')}
                />
                <IndustrialButton
                  title="Supervisor"
                  onPress={() => setFormRole('supervisor')}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <View style={styles.switchRow}>
                <Text style={styles.label}>Usuario activo</Text>
                <Switch
                  value={formActive}
                  onValueChange={setFormActive}
                  trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                  thumbColor={formActive ? '#FFFFFF' : '#9CA3AF'}
                />
              </View>
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <IndustrialButton
              title={editingUser ? 'Actualizar Usuario' : 'Crear Usuario'}
              onPress={handleSaveUser}
              disabled={formLoading || !formName.trim()}
              loading={formLoading}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
  },
  addButton: {
    backgroundColor: '#16A34A',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scrollView: {
    flex: 1,
  },
  userCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 8,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  userInfo: {
    marginBottom: 12,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  roleBadge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
  },
  supervisorBadge: {
    backgroundColor: '#FEF3C7',
    borderColor: '#FCD34D',
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563EB',
  },
  supervisorText: {
    color: '#D97706',
  },
  userDetails: {
    gap: 4,
  },
  userDetail: {
    fontSize: 14,
    color: '#64748B',
  },
  userStatus: {
    fontSize: 14,
    fontWeight: '600',
  },
  activeStatus: {
    color: '#16A34A',
  },
  inactiveStatus: {
    color: '#DC2626',
  },
  userActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    flex: 1,
    backgroundColor: '#3B82F6',
    paddingVertical: 12,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
  },
  activateButton: {
    backgroundColor: '#16A34A',
  },
  deactivateButton: {
    backgroundColor: '#DC2626',
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelButtonText: {
    color: '#6B7280',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1F2937',
    backgroundColor: '#FFFFFF',
    minHeight: 48, // Large touch target
  },
  roleSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  roleButton: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#D1D5DB',
    paddingVertical: 12,
  },
  selectedRoleButton: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  roleButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  selectedRoleButtonText: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  saveButton: {
    backgroundColor: '#16A34A',
    paddingVertical: 16,
  },
});

export default UserManagementScreen;