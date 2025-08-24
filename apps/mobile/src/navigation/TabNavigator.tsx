/**
 * Tab Navigator with Role-Based Access Control
 * Shows different tabs based on user role (operator vs supervisor)
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useAuthStore } from '@stores/auth-store';

// Icons (using text for now, can be replaced with icon library)
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => (
  <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
    {name}
  </Text>
);

interface TabNavigatorProps {
  activeTab: string;
  onTabChange: (tabName: string) => void;
}

export const TabNavigator: React.FC<TabNavigatorProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { isAuthenticated, canAccessDashboard, canManageUsers } = useAuthStore();

  if (!isAuthenticated) {
    return null;
  }

  const baseTabs = [
    {
      name: 'registrations',
      label: 'Registro',
      icon: '📝',
      available: true, // All authenticated users can access
    },
    {
      name: 'today',
      label: 'Hoy',
      icon: '📅',
      available: true, // All authenticated users can access
    },
  ];

  const supervisorTabs = [
    {
      name: 'dashboard',
      label: 'Dashboard',
      icon: '📊',
      available: canAccessDashboard(),
    },
    {
      name: 'sync',
      label: 'Sync',
      icon: '🔄',
      available: canAccessDashboard(),
    },
    {
      name: 'users',
      label: 'Usuarios',
      icon: '👥',
      available: canManageUsers(),
    },
    {
      name: 'reports',
      label: 'Reportes',
      icon: '📈',
      available: canAccessDashboard(),
    },
  ];

  // Combine tabs based on role
  const availableTabs = [
    ...baseTabs,
    ...supervisorTabs.filter(tab => tab.available),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tabBar}>
        {availableTabs.map((tab) => (
          <TouchableOpacity
            key={tab.name}
            style={[
              styles.tab,
              activeTab === tab.name && styles.activeTab,
            ]}
            onPress={() => onTabChange(tab.name)}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.name }}
            accessibilityLabel={`${tab.label} tab`}
          >
            <Text style={[
              styles.tabIcon,
              activeTab === tab.name && styles.activeTabIcon,
            ]}>
              {tab.icon}
            </Text>
            <Text style={[
              styles.tabLabel,
              activeTab === tab.name && styles.activeTabLabel,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: -2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  tabBar: {
    flexDirection: 'row',
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 8,
    minHeight: 60, // Industrial UI requirement: Large touch targets
  },
  activeTab: {
    backgroundColor: '#2563EB',
  },
  tabIcon: {
    fontSize: 24,
    color: '#6B7280',
    marginBottom: 4,
  },
  activeTabIcon: {
    color: '#FFFFFF',
  },
  tabIconFocused: {
    color: '#2563EB',
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '600', // Bold typography for industrial UI
    color: '#6B7280',
    textAlign: 'center',
  },
  activeTabLabel: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});

export default TabNavigator;