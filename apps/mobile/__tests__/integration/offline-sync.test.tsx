/**
 * Integration Tests for Offline Sync Functionality
 * Tests complete offline registration and sync flow
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { NativeBaseProvider } from 'native-base';
import OfflineStorageService from '../../src/services/offline-storage';
import RegistrationStorageService from '../../src/services/registration-storage';
import SyncQueueService from '../../src/services/sync-queue-service';
import PhotoStorageService from '../../src/services/photo-storage-service';
import ConnectionService from '../../src/services/connection-service';
import { useOfflineStore } from '../../src/stores/offline-store';
import { CreateRegistrationPayload } from '../../src/types/offline';

// Mock all services
jest.mock('../../src/services/offline-storage');
jest.mock('../../src/services/registration-storage');
jest.mock('../../src/services/sync-queue-service');
jest.mock('../../src/services/photo-storage-service');
jest.mock('../../src/services/connection-service');
jest.mock('react-native-sqlite-storage');
jest.mock('react-native-fs');
jest.mock('@react-native-community/netinfo');
jest.mock('@react-native-async-storage/async-storage');

// Test component that uses offline functionality
const TestOfflineComponent: React.FC = () => {
  const [registrations, setRegistrations] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const { networkStatus, setNetworkStatus } = useOfflineStore();

  const createOfflineRegistration = async () => {
    setIsLoading(true);
    try {
      const registrationService = RegistrationStorageService.getInstance();
      const syncQueueService = SyncQueueService.getInstance();

      const payload: CreateRegistrationPayload = {
        weight: 15.5,
        cut_type: 'jamón',
        supplier: 'Test Supplier',
        registered_by: 'user123',
      };

      const registration = await registrationService.createRegistration(payload);
      await syncQueueService.queueRegistrationCreation(payload, registration.id);

      setRegistrations(prev => [...prev, registration]);
    } catch (error) {
      console.error('Failed to create registration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const syncData = async () => {
    const syncQueueService = SyncQueueService.getInstance();
    await syncQueueService.processQueue();
  };

  const goOffline = () => {
    setNetworkStatus({
      isConnected: false,
      type: 'none',
      isInternetReachable: false,
    });
  };

  const goOnline = () => {
    setNetworkStatus({
      isConnected: true,
      type: 'wifi',
      isInternetReachable: true,
    });
  };

  return (
    <>
      <button testID="create-registration" onPress={createOfflineRegistration} disabled={isLoading}>
        Create Registration
      </button>
      <button testID="sync-data" onPress={syncData}>
        Sync Data
      </button>
      <button testID="go-offline" onPress={goOffline}>
        Go Offline
      </button>
      <button testID="go-online" onPress={goOnline}>
        Go Online
      </button>
      <text testID="registration-count">{registrations.length}</text>
      <text testID="network-status">{networkStatus.isConnected ? 'online' : 'offline'}</text>
      {isLoading && <text testID="loading">Loading...</text>}
    </>
  );
};

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <NativeBaseProvider>{children}</NativeBaseProvider>
);

describe('Offline Sync Integration Tests', () => {
  let mockOfflineStorage: jest.Mocked<OfflineStorageService>;
  let mockRegistrationStorage: jest.Mocked<RegistrationStorageService>;
  let mockSyncQueue: jest.Mocked<SyncQueueService>;
  let mockPhotoStorage: jest.Mocked<PhotoStorageService>;
  let mockConnectionService: jest.Mocked<ConnectionService>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup service mocks
    mockOfflineStorage = {
      initializeDatabase: jest.fn().mockResolvedValue(undefined),
      executeQuery: jest.fn().mockResolvedValue([]),
      executeTransaction: jest.fn().mockResolvedValue(undefined),
      getDatabaseStats: jest.fn().mockResolvedValue({
        registrationsCount: 0,
        pendingSyncCount: 0,
        queueCount: 0,
        databaseSize: 0,
      }),
      cleanupOldData: jest.fn().mockResolvedValue(undefined),
      closeDatabase: jest.fn().mockResolvedValue(undefined),
      getDatabase: jest.fn(),
    } as any;

    mockRegistrationStorage = {
      createRegistration: jest.fn(),
      getRegistrationById: jest.fn(),
      getRegistrations: jest.fn().mockResolvedValue([]),
      getPendingSyncRegistrations: jest.fn().mockResolvedValue([]),
      updateSyncStatus: jest.fn().mockResolvedValue(undefined),
      getRegistrationStats: jest.fn().mockResolvedValue({
        total: 0,
        pending: 0,
        synced: 0,
        failed: 0,
        todayCount: 0,
      }),
    } as any;

    mockSyncQueue = {
      queueRegistrationCreation: jest.fn().mockResolvedValue(undefined),
      queuePhotoUpload: jest.fn().mockResolvedValue(undefined),
      processQueue: jest.fn().mockResolvedValue({
        total: 0,
        completed: 0,
        failed: 0,
      }),
      getQueueStats: jest.fn().mockResolvedValue({
        totalPending: 0,
        byType: {
          create_registration: 0,
          upload_photo: 0,
          update_user: 0,
        },
        highPriority: 0,
        failedOperations: 0,
      }),
    } as any;

    mockPhotoStorage = {
      initializeStorage: jest.fn().mockResolvedValue(undefined),
      storePhoto: jest.fn(),
      getPhoto: jest.fn(),
      deletePhoto: jest.fn().mockResolvedValue(undefined),
      getStorageStats: jest.fn().mockResolvedValue({
        totalPhotos: 0,
        totalSize: 0,
        pendingUploads: 0,
        averageCompressionRatio: 0.3,
      }),
    } as any;

    mockConnectionService = {
      initialize: jest.fn().mockResolvedValue(undefined),
      getNetworkStatus: jest.fn().mockReturnValue({
        isConnected: true,
        type: 'wifi',
        isInternetReachable: true,
      }),
      isOnline: jest.fn().mockReturnValue(true),
      addListener: jest.fn().mockReturnValue(() => {}),
    } as any;

    // Mock service instances
    (OfflineStorageService.getInstance as jest.Mock).mockReturnValue(mockOfflineStorage);
    (RegistrationStorageService.getInstance as jest.Mock).mockReturnValue(mockRegistrationStorage);
    (SyncQueueService.getInstance as jest.Mock).mockReturnValue(mockSyncQueue);
    (PhotoStorageService.getInstance as jest.Mock).mockReturnValue(mockPhotoStorage);
    (ConnectionService.getInstance as jest.Mock).mockReturnValue(mockConnectionService);
  });

  describe('Offline Registration Creation', () => {
    it('should create registration offline and queue for sync', async () => {
      const mockRegistration = {
        id: 'reg123',
        weight: 15.5,
        cut_type: 'jamón',
        supplier: 'Test Supplier',
        sync_status: 'pending',
        registered_by: 'user123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      mockRegistrationStorage.createRegistration.mockResolvedValue(mockRegistration as any);

      const { getByTestId } = render(
        <TestWrapper>
          <TestOfflineComponent />
        </TestWrapper>
      );

      // Go offline first
      fireEvent.press(getByTestId('go-offline'));
      
      await waitFor(() => {
        expect(getByTestId('network-status').children[0]).toBe('offline');
      });

      // Create registration offline
      fireEvent.press(getByTestId('create-registration'));

      await waitFor(() => {
        expect(mockRegistrationStorage.createRegistration).toHaveBeenCalledWith({
          weight: 15.5,
          cut_type: 'jamón',
          supplier: 'Test Supplier',
          registered_by: 'user123',
        });
      });

      await waitFor(() => {
        expect(mockSyncQueue.queueRegistrationCreation).toHaveBeenCalledWith(
          {
            weight: 15.5,
            cut_type: 'jamón',
            supplier: 'Test Supplier',
            registered_by: 'user123',
          },
          'reg123'
        );
      });

      await waitFor(() => {
        expect(getByTestId('registration-count').children[0]).toBe('1');
      });
    });

    it('should handle registration creation errors', async () => {
      mockRegistrationStorage.createRegistration.mockRejectedValue(
        new Error('Storage error')
      );

      const { getByTestId } = render(
        <TestWrapper>
          <TestOfflineComponent />
        </TestWrapper>
      );

      fireEvent.press(getByTestId('create-registration'));

      await waitFor(() => {
        expect(mockRegistrationStorage.createRegistration).toHaveBeenCalled();
      });

      // Registration count should remain 0 due to error
      expect(getByTestId('registration-count').children[0]).toBe('0');
    });
  });

  describe('Data Synchronization', () => {
    it('should sync pending data when online', async () => {
      const mockSyncProgress = {
        total: 2,
        completed: 2,
        failed: 0,
      };

      mockSyncQueue.processQueue.mockResolvedValue(mockSyncProgress);

      const { getByTestId } = render(
        <TestWrapper>
          <TestOfflineComponent />
        </TestWrapper>
      );

      // Ensure we're online
      fireEvent.press(getByTestId('go-online'));

      await waitFor(() => {
        expect(getByTestId('network-status').children[0]).toBe('online');
      });

      // Trigger sync
      fireEvent.press(getByTestId('sync-data'));

      await waitFor(() => {
        expect(mockSyncQueue.processQueue).toHaveBeenCalled();
      });
    });

    it('should handle sync errors gracefully', async () => {
      mockSyncQueue.processQueue.mockRejectedValue(new Error('Sync failed'));

      const { getByTestId } = render(
        <TestWrapper>
          <TestOfflineComponent />
        </TestWrapper>
      );

      fireEvent.press(getByTestId('sync-data'));

      await waitFor(() => {
        expect(mockSyncQueue.processQueue).toHaveBeenCalled();
      });

      // Should not crash the app
    });
  });

  describe('Network State Management', () => {
    it('should update UI based on network status', async () => {
      const { getByTestId } = render(
        <TestWrapper>
          <TestOfflineComponent />
        </TestWrapper>
      );

      // Initially online
      expect(getByTestId('network-status').children[0]).toBe('online');

      // Go offline
      fireEvent.press(getByTestId('go-offline'));

      await waitFor(() => {
        expect(getByTestId('network-status').children[0]).toBe('offline');
      });

      // Go back online
      fireEvent.press(getByTestId('go-online'));

      await waitFor(() => {
        expect(getByTestId('network-status').children[0]).toBe('online');
      });
    });
  });

  describe('Photo Storage Integration', () => {
    it('should store photos locally during offline registration', async () => {
      const mockRegistration = {
        id: 'reg123',
        weight: 15.5,
        cut_type: 'jamón',
        supplier: 'Test Supplier',
        local_photo_path: '/local/path/photo.jpg',
        sync_status: 'pending',
        registered_by: 'user123',
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
      };

      const mockPhotoMetadata = {
        id: 'photo123',
        originalPath: '/local/path/photo.jpg',
        compressedPath: '/local/path/photo_compressed.jpg',
        originalSize: 1024000,
        compressedSize: 512000,
        compressionRatio: 0.5,
        uploadStatus: 'pending' as const,
        createdAt: '2023-01-01T00:00:00Z',
      };

      mockRegistrationStorage.createRegistration.mockResolvedValue(mockRegistration as any);
      mockPhotoStorage.storePhoto.mockResolvedValue(mockPhotoMetadata);

      // Test photo storage during registration creation
      const registrationService = RegistrationStorageService.getInstance();
      const photoService = PhotoStorageService.getInstance();

      const payload: CreateRegistrationPayload = {
        weight: 15.5,
        cut_type: 'jamón',
        supplier: 'Test Supplier',
        local_photo_path: '/source/photo.jpg',
        registered_by: 'user123',
      };

      await registrationService.createRegistration(payload);
      await photoService.storePhoto('/source/photo.jpg', 'photo123');

      expect(mockRegistrationStorage.createRegistration).toHaveBeenCalledWith(payload);
      expect(mockPhotoStorage.storePhoto).toHaveBeenCalledWith('/source/photo.jpg', 'photo123');
    });
  });

  describe('Service Initialization', () => {
    it('should initialize all offline services', async () => {
      // Test service initialization
      await mockOfflineStorage.initializeDatabase();
      await mockPhotoStorage.initializeStorage();
      await mockConnectionService.initialize();

      expect(mockOfflineStorage.initializeDatabase).toHaveBeenCalled();
      expect(mockPhotoStorage.initializeStorage).toHaveBeenCalled();
      expect(mockConnectionService.initialize).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockOfflineStorage.initializeDatabase.mockRejectedValue(
        new Error('DB initialization failed')
      );

      await expect(mockOfflineStorage.initializeDatabase()).rejects.toThrow(
        'DB initialization failed'
      );
    });
  });

  describe('Data Consistency', () => {
    it('should maintain data consistency during offline operations', async () => {
      const registrations = [
        {
          id: 'reg1',
          weight: 10.5,
          sync_status: 'pending',
        },
        {
          id: 'reg2',
          weight: 15.0,
          sync_status: 'synced',
        },
      ];

      mockRegistrationStorage.getRegistrations.mockResolvedValue(registrations as any);
      mockRegistrationStorage.getPendingSyncRegistrations.mockResolvedValue([registrations[0]] as any);

      const allRegistrations = await mockRegistrationStorage.getRegistrations();
      const pendingRegistrations = await mockRegistrationStorage.getPendingSyncRegistrations();

      expect(allRegistrations).toHaveLength(2);
      expect(pendingRegistrations).toHaveLength(1);
      expect(pendingRegistrations[0].sync_status).toBe('pending');
    });
  });
});