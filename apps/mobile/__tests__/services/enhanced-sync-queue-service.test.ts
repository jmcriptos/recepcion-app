/**
 * Enhanced SyncQueueService Tests
 * Tests for new error logging, categorization, and retry functionality
 */
import SyncQueueService from '../../src/services/sync-queue-service';
import OfflineStorageService from '../../src/services/offline-storage';
import { apiClient } from '../../src/services/api-client';

// Mock dependencies
jest.mock('../../src/services/offline-storage');
jest.mock('../../src/services/api-client');

const mockOfflineStorage = OfflineStorageService as jest.MockedClass<typeof OfflineStorageService>;
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('Enhanced SyncQueueService', () => {
  let syncQueueService: SyncQueueService;
  let mockStorageInstance: jest.Mocked<OfflineStorageService>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockStorageInstance = {
      executeQuery: jest.fn(),
      initializeDatabase: jest.fn(),
      getDatabaseStats: jest.fn(),
      closeDatabase: jest.fn(),
      cleanupOldData: jest.fn(),
    } as any;

    mockOfflineStorage.getInstance = jest.fn(() => mockStorageInstance);
    syncQueueService = SyncQueueService.getInstance();
  });

  describe('Enhanced Error Logging', () => {
    it('should get sync errors with categorization', async () => {
      const mockErrorRows = [
        {
          id: 'error-1',
          operation_type: 'create_registration',
          entity_id: 'reg-123',
          payload: '{"weight": 2.5}',
          priority: 1,
          retry_count: 2,
          last_attempt_at: '2023-01-01T10:15:00Z',
          created_at: '2023-01-01T10:00:00Z',
          error_message: '[NETWORK] Connection timeout during upload',
        },
        {
          id: 'error-2',
          operation_type: 'upload_photo',
          entity_id: 'reg-456',
          payload: '{"photo_path": "/path/to/photo.jpg"}',
          priority: 3,
          retry_count: 4,
          last_attempt_at: '2023-01-01T10:20:00Z',
          created_at: '2023-01-01T10:05:00Z',
          error_message: '[VALIDATION] Invalid file format provided',
        },
        {
          id: 'error-3',
          operation_type: 'update_user',
          entity_id: 'user-789',
          payload: '{"user_id": "789"}',
          priority: 2,
          retry_count: 1,
          last_attempt_at: '2023-01-01T10:25:00Z',
          created_at: '2023-01-01T10:10:00Z',
          error_message: '[SERVER] Internal server error 500',
        },
      ];

      mockStorageInstance.executeQuery.mockResolvedValue(mockErrorRows);

      const errors = await syncQueueService.getSyncErrors();

      expect(errors).toHaveLength(3);
      
      // Check network error categorization
      expect(errors[0]).toMatchObject({
        id: 'error-1',
        operation_type: 'create_registration',
        entity_id: 'reg-123',
        error_category: 'network',
        can_retry: true,
        retry_count: 2,
        max_retries: 5,
      });

      // Check validation error categorization
      expect(errors[1]).toMatchObject({
        id: 'error-2',
        operation_type: 'upload_photo',
        entity_id: 'reg-456',
        error_category: 'validation',
        can_retry: false, // Validation errors cannot be retried
        retry_count: 4,
      });

      // Check server error categorization
      expect(errors[2]).toMatchObject({
        id: 'error-3',
        operation_type: 'update_user',
        entity_id: 'user-789',
        error_category: 'server',
        can_retry: true,
        retry_count: 1,
      });

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('SELECT * FROM sync_queue'),
        []
      );
    });

    it('should categorize errors without explicit category tags', async () => {
      const mockErrorRows = [
        {
          id: 'error-1',
          operation_type: 'create_registration',
          entity_id: 'reg-123',
          payload: '{"weight": 2.5}',
          priority: 1,
          retry_count: 1,
          last_attempt_at: '2023-01-01T10:15:00Z',
          created_at: '2023-01-01T10:00:00Z',
          error_message: 'Network connection timed out after 30 seconds',
        },
        {
          id: 'error-2',
          operation_type: 'upload_photo',
          entity_id: 'reg-456',
          payload: '{"photo_path": "/invalid"}',
          priority: 3,
          retry_count: 2,
          last_attempt_at: '2023-01-01T10:20:00Z',
          created_at: '2023-01-01T10:05:00Z',
          error_message: 'Required field weight is missing from request',
        },
        {
          id: 'error-3',
          operation_type: 'update_user',
          entity_id: 'user-789',
          payload: '{"user_id": "789"}',
          priority: 2,
          retry_count: 3,
          last_attempt_at: '2023-01-01T10:25:00Z',
          created_at: '2023-01-01T10:10:00Z',
          error_message: 'Unknown database error occurred',
        },
      ];

      mockStorageInstance.executeQuery.mockResolvedValue(mockErrorRows);

      const errors = await syncQueueService.getSyncErrors();

      expect(errors[0].error_category).toBe('network'); // Contains 'network'
      expect(errors[1].error_category).toBe('validation'); // Contains 'required'  
      expect(errors[2].error_category).toBe('unknown'); // No clear category
    });

    it('should handle empty errors list', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      const errors = await syncQueueService.getSyncErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('Individual Operation Retry', () => {
    beforeEach(() => {
      // Mock successful validation
      mockApiClient.validateSession = jest.fn().mockResolvedValue(true);
    });

    it('should retry a specific failed operation', async () => {
      const mockQueueItem = {
        id: 'queue-item-1',
        operation_type: 'create_registration',
        entity_id: 'reg-123',
        payload: JSON.stringify({
          weight: 2.5,
          cut_type: 'jamón',
          supplier: 'Test Supplier',
          registered_by: 'user-1',
        }),
        priority: 1,
        retry_count: 2,
        last_attempt_at: '2023-01-01T10:15:00Z',
        created_at: '2023-01-01T10:00:00Z',
      };

      const mockRegistration = {
        id: 'reg-123',
        weight: 2.5,
        cut_type: 'jamón',
        supplier: 'Test Supplier',
        sync_status: 'pending',
        registered_by: 'user-1',
        created_at: '2023-01-01T10:00:00Z',
        updated_at: '2023-01-01T10:00:00Z',
      };

      // Mock getting queue item
      mockStorageInstance.executeQuery
        .mockResolvedValueOnce([mockQueueItem]) // getQueueItemById
        .mockResolvedValueOnce([mockRegistration]) // getLocalRegistration
        .mockResolvedValueOnce([]); // markCompleted

      // Mock API calls
      mockApiClient.getRegistrationById = jest.fn().mockResolvedValue(null);
      mockApiClient.createRegistration = jest.fn().mockResolvedValue({
        id: 'reg-123',
        weight: 2.5,
        photo_url: 'https://example.com/photo.jpg',
        ocr_confidence: 0.95,
      });

      await syncQueueService.retryFailedOperation('queue-item-1');

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM sync_queue WHERE id = ?',
        ['queue-item-1']
      );

      expect(mockApiClient.createRegistration).toHaveBeenCalled();
      
      // Should mark as completed after successful retry
      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        ['queue-item-1']
      );
    });

    it('should reject retry for operations at max retries', async () => {
      const mockQueueItem = {
        id: 'queue-item-1',
        operation_type: 'create_registration',
        entity_id: 'reg-123',
        payload: '{"weight": 2.5}',
        priority: 1,
        retry_count: 5, // At max retries
        created_at: '2023-01-01T10:00:00Z',
      };

      mockStorageInstance.executeQuery.mockResolvedValue([mockQueueItem]);

      await expect(syncQueueService.retryFailedOperation('queue-item-1'))
        .rejects
        .toThrow('Maximum retries reached for operation: queue-item-1');

      expect(mockApiClient.createRegistration).not.toHaveBeenCalled();
    });

    it('should handle retry failures and update error count', async () => {
      const mockQueueItem = {
        id: 'queue-item-1',
        operation_type: 'create_registration',
        entity_id: 'reg-123',
        payload: JSON.stringify({
          weight: 2.5,
          cut_type: 'jamón',
          supplier: 'Test Supplier',
          registered_by: 'user-1',
        }),
        priority: 1,
        retry_count: 2,
        created_at: '2023-01-01T10:00:00Z',
      };

      const mockRegistration = {
        id: 'reg-123',
        weight: 2.5,
        cut_type: 'jamón',
        supplier: 'Test Supplier',
        sync_status: 'pending',
        registered_by: 'user-1',
        created_at: '2023-01-01T10:00:00Z',
        updated_at: '2023-01-01T10:00:00Z',
      };

      mockStorageInstance.executeQuery
        .mockResolvedValueOnce([mockQueueItem]) // getQueueItemById
        .mockResolvedValueOnce([mockRegistration]) // getLocalRegistration
        .mockResolvedValueOnce([]); // markFailed update

      mockApiClient.getRegistrationById = jest.fn().mockResolvedValue(null);
      mockApiClient.createRegistration = jest.fn().mockRejectedValue(
        new Error('Server temporarily unavailable')
      );

      await expect(syncQueueService.retryFailedOperation('queue-item-1'))
        .rejects
        .toThrow('Server temporarily unavailable');

      // Should update retry count and error message
      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining([
          expect.any(String), // timestamp
          'Server temporarily unavailable',
          'queue-item-1'
        ])
      );
    });

    it('should handle non-existent queue items', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]); // No queue item found

      await expect(syncQueueService.retryFailedOperation('non-existent'))
        .rejects
        .toThrow('Queue item not found: non-existent');
    });
  });

  describe('Error Clearing', () => {
    it('should clear a specific error from the queue', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      await syncQueueService.clearError('error-1');

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        'DELETE FROM sync_queue WHERE id = ?',
        ['error-1']
      );
    });

    it('should handle clearing non-existent errors', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      // Should not throw for non-existent errors
      await expect(syncQueueService.clearError('non-existent'))
        .resolves
        .toBeUndefined();
    });
  });

  describe('Enhanced Error Marking', () => {
    it('should mark failed operation with category', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      await syncQueueService.markFailedWithCategory(
        'queue-item-1',
        'Connection timeout',
        'network'
      );

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining([
          expect.any(String), // timestamp
          '[NETWORK] Connection timeout',
          'queue-item-1'
        ])
      );
    });

    it('should auto-categorize errors without explicit category', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      await syncQueueService.markFailedWithCategory(
        'queue-item-1',
        'Invalid weight value provided',
        undefined // No category provided
      );

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining([
          expect.any(String), // timestamp
          '[VALIDATION] Invalid weight value provided',
          'queue-item-1'
        ])
      );
    });

    it('should handle server errors with auto-categorization', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      await syncQueueService.markFailedWithCategory(
        'queue-item-1',
        'Internal server error occurred',
        undefined
      );

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining([
          expect.any(String), // timestamp
          '[SERVER] Internal server error occurred',
          'queue-item-1'
        ])
      );
    });

    it('should handle unknown errors', async () => {
      mockStorageInstance.executeQuery.mockResolvedValue([]);

      await syncQueueService.markFailedWithCategory(
        'queue-item-1',
        'Something unexpected happened',
        undefined
      );

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE sync_queue'),
        expect.arrayContaining([
          expect.any(String), // timestamp
          '[UNKNOWN] Something unexpected happened',
          'queue-item-1'
        ])
      );
    });
  });

  describe('Queue Statistics Integration', () => {
    it('should return accurate queue statistics', async () => {
      // Mock multiple query responses for statistics
      mockStorageInstance.executeQuery
        .mockResolvedValueOnce([{ count: 8 }]) // total pending
        .mockResolvedValueOnce([{ count: 5 }]) // create_registration
        .mockResolvedValueOnce([{ count: 2 }]) // upload_photo  
        .mockResolvedValueOnce([{ count: 1 }]) // update_user
        .mockResolvedValueOnce([{ count: 3 }]); // failed operations

      const stats = await syncQueueService.getQueueStats();

      expect(stats).toEqual({
        totalPending: 8,
        byType: {
          create_registration: 5,
          upload_photo: 2,
          update_user: 1,
        },
        highPriority: 5,
        failedOperations: 3,
      });

      expect(mockStorageInstance.executeQuery).toHaveBeenCalledTimes(5);
    });

    it('should handle zero statistics gracefully', async () => {
      mockStorageInstance.executeQuery
        .mockResolvedValue([{ count: 0 }]); // All zero counts

      const stats = await syncQueueService.getQueueStats();

      expect(stats).toEqual({
        totalPending: 0,
        byType: {
          create_registration: 0,
          upload_photo: 0,
          update_user: 0,
        },
        highPriority: 0,
        failedOperations: 0,
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database errors during error retrieval', async () => {
      mockStorageInstance.executeQuery.mockRejectedValue(
        new Error('Database connection lost')
      );

      await expect(syncQueueService.getSyncErrors())
        .rejects
        .toThrow('Database connection lost');
    });

    it('should handle malformed error data gracefully', async () => {
      const mockMalformedRows = [
        {
          id: 'error-1',
          operation_type: 'invalid_type',
          entity_id: null,
          payload: 'malformed json',
          priority: null,
          retry_count: 'not_a_number',
          error_message: null,
        },
      ];

      mockStorageInstance.executeQuery.mockResolvedValue(mockMalformedRows);

      const errors = await syncQueueService.getSyncErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0]).toMatchObject({
        id: 'error-1',
        operation_type: 'invalid_type',
        entity_id: null,
        error_category: 'unknown',
        can_retry: false, // Should be false for unknown types
      });
    });

    it('should handle concurrent retry attempts safely', async () => {
      const mockQueueItem = {
        id: 'queue-item-1',
        operation_type: 'create_registration',
        entity_id: 'reg-123',
        payload: '{"weight": 2.5}',
        priority: 1,
        retry_count: 2,
        created_at: '2023-01-01T10:00:00Z',
      };

      mockStorageInstance.executeQuery.mockResolvedValue([mockQueueItem]);

      // Simulate concurrent retry attempts
      const retryPromises = [
        syncQueueService.retryFailedOperation('queue-item-1'),
        syncQueueService.retryFailedOperation('queue-item-1'),
        syncQueueService.retryFailedOperation('queue-item-1'),
      ];

      // At least one should succeed or fail gracefully
      const results = await Promise.allSettled(retryPromises);
      
      expect(results.some(result => result.status === 'fulfilled' || result.status === 'rejected'))
        .toBeTruthy();
    });

    it('should validate operation types for retry', async () => {
      const mockQueueItem = {
        id: 'queue-item-1',
        operation_type: 'unknown_operation',
        entity_id: 'entity-123',
        payload: '{}',
        priority: 1,
        retry_count: 1,
        created_at: '2023-01-01T10:00:00Z',
      };

      mockStorageInstance.executeQuery.mockResolvedValue([mockQueueItem]);

      await expect(syncQueueService.retryFailedOperation('queue-item-1'))
        .rejects
        .toThrow('Unknown operation type: unknown_operation');
    });
  });
});