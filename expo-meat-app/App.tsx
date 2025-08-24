import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Modal,
  Switch,
  StatusBar
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = 'http://192.168.50.232:8080/api/v1';

interface User {
  id: number;
  username: string;
  role: string;
  full_name: string;
}

interface Registration {
  id: string;
  weight: number;
  operator: string;
  timestamp: string;
  synced: boolean;
}

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [weight, setWeight] = useState('');
  const [showCamera, setShowCamera] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [pendingSync, setPendingSync] = useState(0);

  useEffect(() => {
    loadUserData();
    loadOfflineRegistrations();
  }, []);

  const loadUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('currentUser');
      if (userData) {
        setCurrentUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const loadOfflineRegistrations = async () => {
    try {
      const storedRegistrations = await AsyncStorage.getItem('offlineRegistrations');
      if (storedRegistrations) {
        const regs = JSON.parse(storedRegistrations);
        setRegistrations(regs);
        setPendingSync(regs.filter((r: Registration) => !r.synced).length);
      }
    } catch (error) {
      console.error('Error loading offline registrations:', error);
    }
  };

  const saveOfflineRegistrations = async (regs: Registration[]) => {
    try {
      await AsyncStorage.setItem('offlineRegistrations', JSON.stringify(regs));
      setPendingSync(regs.filter(r => !r.synced).length);
    } catch (error) {
      console.error('Error saving offline registrations:', error);
    }
  };

  const login = async () => {
    if (!username || !password) {
      Alert.alert('Error', 'Por favor ingrese usuario y contraseña');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        const user = {
          id: data.user.id,
          username: data.user.username,
          role: data.user.role,
          full_name: data.user.full_name
        };
        
        setCurrentUser(user);
        await AsyncStorage.setItem('currentUser', JSON.stringify(user));
        await AsyncStorage.setItem('authToken', data.access_token);
        
        Alert.alert('Éxito', `Bienvenido ${data.user.full_name}`);
        setIsOffline(false);
      } else {
        Alert.alert('Error de Login', data.error || 'Credenciales inválidas');
      }
    } catch (error) {
      console.error('Login error:', error);
      setIsOffline(true);
      Alert.alert('Sin Conexión', 'Trabajando en modo offline');
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setCurrentUser(null);
    setUsername('');
    setPassword('');
    await AsyncStorage.removeItem('currentUser');
    await AsyncStorage.removeItem('authToken');
  };

  const registerWeight = async () => {
    if (!weight) {
      Alert.alert('Error', 'Por favor ingrese el peso');
      return;
    }

    const weightValue = parseFloat(weight);
    if (isNaN(weightValue) || weightValue <= 0) {
      Alert.alert('Error', 'Por favor ingrese un peso válido');
      return;
    }

    const registration: Registration = {
      id: Date.now().toString(),
      weight: weightValue,
      operator: currentUser?.full_name || 'Usuario Offline',
      timestamp: new Date().toISOString(),
      synced: false
    };

    setLoading(true);
    
    try {
      // Try to sync online first
      const token = await AsyncStorage.getItem('authToken');
      if (token && !isOffline) {
        const response = await fetch(`${API_BASE_URL}/registrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            weight: weightValue,
            user_id: currentUser?.id
          }),
        });

        if (response.ok) {
          registration.synced = true;
          Alert.alert('Éxito', 'Peso registrado online');
        } else {
          throw new Error('Error de servidor');
        }
      } else {
        throw new Error('Offline mode');
      }
    } catch (error) {
      console.error('Registration error:', error);
      Alert.alert('Guardado Offline', 'El peso se guardó localmente para sincronizar después');
    }

    // Save to offline storage regardless
    const updatedRegistrations = [...registrations, registration];
    setRegistrations(updatedRegistrations);
    await saveOfflineRegistrations(updatedRegistrations);
    setWeight('');
    setLoading(false);
  };

  const syncOfflineData = async () => {
    const token = await AsyncStorage.getItem('authToken');
    if (!token) {
      Alert.alert('Error', 'No hay sesión activa para sincronizar');
      return;
    }

    setLoading(true);
    const unsyncedRegistrations = registrations.filter(r => !r.synced);
    let syncedCount = 0;

    for (const registration of unsyncedRegistrations) {
      try {
        const response = await fetch(`${API_BASE_URL}/registrations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            weight: registration.weight,
            user_id: currentUser?.id,
            timestamp: registration.timestamp
          }),
        });

        if (response.ok) {
          registration.synced = true;
          syncedCount++;
        }
      } catch (error) {
        console.error('Sync error for registration:', registration.id, error);
      }
    }

    await saveOfflineRegistrations(registrations);
    setLoading(false);
    
    if (syncedCount > 0) {
      setIsOffline(false);
      Alert.alert('Sincronización', `${syncedCount} registros sincronizados`);
    } else {
      Alert.alert('Error de Sincronización', 'No se pudo conectar al servidor');
    }
  };

  const simulateCamera = () => {
    setShowCamera(true);
  };

  const processCameraResult = (simulatedWeight: string) => {
    setWeight(simulatedWeight);
    setShowCamera(false);
    Alert.alert('OCR Simulado', `Peso detectado: ${simulatedWeight} kg`);
  };

  if (!currentUser) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <View style={styles.loginContainer}>
          <Text style={styles.title}>Meat Reception App</Text>
          <Text style={styles.subtitle}>Registro de Pesos de Carne</Text>
          
          {isOffline && (
            <View style={styles.offlineIndicator}>
              <Text style={styles.offlineText}>⚠️ Modo Offline</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="Usuario"
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity 
            style={styles.button} 
            onPress={login}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>

          <View style={styles.userSelectors}>
            <Text style={styles.selectorTitle}>Usuarios de prueba:</Text>
            <TouchableOpacity 
              style={styles.userButton}
              onPress={() => { setUsername('operador1'); setPassword('password123'); }}
            >
              <Text style={styles.userButtonText}>Operador 1</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.userButton}
              onPress={() => { setUsername('operador2'); setPassword('password123'); }}
            >
              <Text style={styles.userButtonText}>Operador 2</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.userButton}
              onPress={() => { setUsername('supervisor'); setPassword('admin123'); }}
            >
              <Text style={styles.userButtonText}>Supervisor</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <ScrollView style={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.welcomeText}>
            Bienvenido, {currentUser.full_name}
          </Text>
          <Text style={styles.roleText}>Rol: {currentUser.role}</Text>
          
          <View style={styles.statusRow}>
            {isOffline && (
              <View style={styles.offlineIndicator}>
                <Text style={styles.offlineText}>⚠️ Offline</Text>
              </View>
            )}
            
            {pendingSync > 0 && (
              <View style={styles.syncIndicator}>
                <Text style={styles.syncText}>📤 {pendingSync} pendientes</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.registrationForm}>
          <Text style={styles.sectionTitle}>Registrar Nuevo Peso</Text>
          
          <View style={styles.weightInputContainer}>
            <TextInput
              style={styles.weightInput}
              placeholder="Peso (kg)"
              value={weight}
              onChangeText={setWeight}
              keyboardType="numeric"
            />
            
            <TouchableOpacity 
              style={styles.cameraButton}
              onPress={simulateCamera}
            >
              <Text style={styles.cameraButtonText}>📸</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            style={styles.registerButton} 
            onPress={registerWeight}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.buttonText}>Registrar Peso</Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.actionsContainer}>
          {pendingSync > 0 && (
            <TouchableOpacity 
              style={styles.syncButton} 
              onPress={syncOfflineData}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                Sincronizar ({pendingSync})
              </Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={logout}
          >
            <Text style={styles.buttonText}>Cerrar Sesión</Text>
          </TouchableOpacity>
        </View>

        {registrations.length > 0 && (
          <View style={styles.historyContainer}>
            <Text style={styles.sectionTitle}>Registros Recientes</Text>
            {registrations.slice(-5).reverse().map((reg) => (
              <View key={reg.id} style={styles.registrationItem}>
                <Text style={styles.registrationWeight}>{reg.weight} kg</Text>
                <Text style={styles.registrationOperator}>{reg.operator}</Text>
                <Text style={styles.registrationTime}>
                  {new Date(reg.timestamp).toLocaleString()}
                </Text>
                <Text style={[
                  styles.syncStatus,
                  { color: reg.synced ? 'green' : 'orange' }
                ]}>
                  {reg.synced ? '✓ Sincronizado' : '⏳ Pendiente'}
                </Text>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Camera Simulation Modal */}
      <Modal
        visible={showCamera}
        animationType="slide"
        onRequestClose={() => setShowCamera(false)}
      >
        <View style={styles.cameraModal}>
          <Text style={styles.cameraTitle}>Simular Captura de Peso</Text>
          <Text style={styles.cameraInstructions}>
            Selecciona un peso simulado:
          </Text>
          
          <View style={styles.simulatedWeights}>
            {['12.5', '15.8', '23.2', '8.7', '31.4'].map((w) => (
              <TouchableOpacity 
                key={w}
                style={styles.weightOption}
                onPress={() => processCameraResult(w)}
              >
                <Text style={styles.weightOptionText}>{w} kg</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity 
            style={styles.cancelButton}
            onPress={() => setShowCamera(false)}
          >
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContainer: {
    flex: 1,
    padding: 20,
  },
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2c3e50',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    color: '#7f8c8d',
  },
  header: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  welcomeText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#2c3e50',
    marginBottom: 5,
  },
  roleText: {
    fontSize: 16,
    color: '#7f8c8d',
    marginBottom: 10,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 10,
  },
  offlineIndicator: {
    backgroundColor: '#f39c12',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
  },
  offlineText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  syncIndicator: {
    backgroundColor: '#3498db',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 15,
  },
  syncText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  registrationForm: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2c3e50',
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 15,
  },
  weightInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  cameraButton: {
    backgroundColor: '#3498db',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
  },
  cameraButtonText: {
    fontSize: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#bdc3c7',
    borderRadius: 8,
    padding: 15,
    marginBottom: 15,
    fontSize: 16,
    backgroundColor: 'white',
  },
  button: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  registerButton: {
    backgroundColor: '#27ae60',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  syncButton: {
    backgroundColor: '#3498db',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 10,
  },
  logoutButton: {
    backgroundColor: '#e74c3c',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionsContainer: {
    marginBottom: 20,
  },
  userSelectors: {
    marginTop: 30,
    alignItems: 'center',
  },
  selectorTitle: {
    fontSize: 16,
    marginBottom: 15,
    color: '#7f8c8d',
  },
  userButton: {
    backgroundColor: '#34495e',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
    marginBottom: 8,
    minWidth: 120,
  },
  userButtonText: {
    color: 'white',
    textAlign: 'center',
    fontSize: 14,
  },
  historyContainer: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  registrationItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#ecf0f1',
    paddingBottom: 10,
    marginBottom: 10,
  },
  registrationWeight: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2c3e50',
  },
  registrationOperator: {
    fontSize: 14,
    color: '#7f8c8d',
    marginTop: 2,
  },
  registrationTime: {
    fontSize: 12,
    color: '#95a5a6',
    marginTop: 2,
  },
  syncStatus: {
    fontSize: 12,
    marginTop: 2,
    fontWeight: 'bold',
  },
  cameraModal: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#2c3e50',
    padding: 20,
  },
  cameraTitle: {
    fontSize: 24,
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  cameraInstructions: {
    fontSize: 16,
    color: 'white',
    marginBottom: 30,
    textAlign: 'center',
  },
  simulatedWeights: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 15,
    marginBottom: 40,
  },
  weightOption: {
    backgroundColor: '#27ae60',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderRadius: 10,
    minWidth: 80,
  },
  weightOptionText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: '#e74c3c',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
  },
});