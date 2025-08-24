/**
 * Unit Tests for Offline Storage Service
 * Tests SQLite operations and data integrity
 */

import OfflineStorageService from '../../../src/services/offline-storage';
import { ALL_CREATE_STATEMENTS } from '../../../src/utils/database-schema';

// Mock SQLite
jest.mock('react-native-sqlite-storage', () => ({
  DEBUG: jest.fn(),
  enablePromise: jest.fn(),
  openDatabase: jest.fn(() => ({
    executeSql: jest.fn(),
    transaction: jest.fn(),
    close: jest.fn(),
  })),
}));

describe('OfflineStorageService', () => {
  let storageService: OfflineStorageService;
  let mockDatabase: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock database
    mockDatabase = {
      executeSql: jest.fn(),
      transaction: jest.fn(),
      close: jest.fn(),
    };

    // Mock SQLite openDatabase to return our mock
    const SQLite = require('react-native-sqlite-storage');
    SQLite.openDatabase.mockResolvedValue(mockDatabase);

    storageService = OfflineStorageService.getInstance();
  });

  describe('Database Initialization', () => {
    it('should initialize database successfully', async () => {
      // Mock version check
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 0 }) } }]);
        }
        return Promise.resolve([]);
      });

      await storageService.initializeDatabase();

      expect(mockDatabase.executeSql).toHaveBeenCalledWith('PRAGMA user_version');
      expect(mockDatabase.executeSql).toHaveBeenCalledWith('PRAGMA user_version = 1');
    });

    it('should create all required tables', async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 0 }) } }]);
        }
        return Promise.resolve([]);
      });

      await storageService.initializeDatabase();

      // Verify all CREATE statements were executed
      ALL_CREATE_STATEMENTS.forEach(statement => {
        expect(mockDatabase.executeSql).toHaveBeenCalledWith(statement);
      });
    });

    it('should handle database initialization errors', async () => {
      mockDatabase.executeSql.mockRejectedValue(new Error('Database error'));

      await expect(storageService.initializeDatabase()).rejects.toThrow('Database initialization failed');
    });

    it('should skip table creation if database version is current', async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 1 }) } }]);
        }
        return Promise.resolve([]);
      });

      await storageService.initializeDatabase();

      // Should only check version, not create tables
      expect(mockDatabase.executeSql).toHaveBeenCalledTimes(1);
      expect(mockDatabase.executeSql).toHaveBeenCalledWith('PRAGMA user_version');
    });
  });

  describe('Query Execution', () => {
    beforeEach(async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 1 }) } }]);
        }
        return Promise.resolve([]);
      });
      
      await storageService.initializeDatabase();
      jest.clearAllMocks();
    });

    it('should execute queries with parameters', async () => {
      const mockResult = {
        rows: {
          length: 1,
          item: (index: number) => ({ id: '1', name: 'Test' }),
        },
      };
      
      mockDatabase.executeSql.mockResolvedValue([mockResult]);

      const result = await storageService.executeQuery(
        'SELECT * FROM users WHERE id = ?',
        ['1']
      );

      expect(mockDatabase.executeSql).toHaveBeenCalledWith(
        'SELECT * FROM users WHERE id = ?',
        ['1']
      );
      expect(result).toEqual([{ id: '1', name: 'Test' }]);
    });

    it('should handle empty query results', async () => {
      const mockResult = { rows: { length: 0 } };
      mockDatabase.executeSql.mockResolvedValue([mockResult]);

      const result = await storageService.executeQuery('SELECT * FROM users');

      expect(result).toEqual([]);
    });

    it('should handle query errors', async () => {
      mockDatabase.executeSql.mockRejectedValue(new Error('Query error'));

      await expect(
        storageService.executeQuery('INVALID SQL')
      ).rejects.toThrow('Query error');
    });

    it('should throw error if database not initialized', async () => {
      const uninitializedService = new (OfflineStorageService as any)();

      await expect(
        uninitializedService.executeQuery('SELECT * FROM users')
      ).rejects.toThrow('Database not initialized');
    });
  });

  describe('Transactions', () => {
    beforeEach(async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 1 }) } }]);
        }
        return Promise.resolve([]);
      });
      
      await storageService.initializeDatabase();
      jest.clearAllMocks();
    });

    it('should execute transaction operations', async () => {
      const mockTransaction = {
        executeSql: jest.fn().mockResolvedValue([]),
      };
      
      mockDatabase.transaction.mockImplementation(
        (callback: (tx: any) => Promise<void>) => callback(mockTransaction)
      );

      const operations = [
        { sql: 'INSERT INTO users (id, name) VALUES (?, ?)', params: ['1', 'Test'] },
        { sql: 'UPDATE users SET name = ? WHERE id = ?', params: ['Updated', '1'] },
      ];

      await storageService.executeTransaction(operations);

      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(mockTransaction.executeSql).toHaveBeenCalledTimes(2);
      expect(mockTransaction.executeSql).toHaveBeenCalledWith(operations[0].sql, operations[0].params);
      expect(mockTransaction.executeSql).toHaveBeenCalledWith(operations[1].sql, operations[1].params);
    });

    it('should handle transaction errors', async () => {
      mockDatabase.transaction.mockRejectedValue(new Error('Transaction failed'));

      const operations = [{ sql: 'INSERT INTO users VALUES (1)', params: [] }];

      await expect(
        storageService.executeTransaction(operations)
      ).rejects.toThrow('Transaction failed');
    });
  });

  describe('Database Statistics', () => {
    beforeEach(async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 1 }) } }]);
        }
        return Promise.resolve([]);
      });
      
      await storageService.initializeDatabase();
      jest.clearAllMocks();
    });

    it('should get database statistics', async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('COUNT(*) as count FROM weight_registrations WHERE')) {
          return Promise.resolve([{ rows: { item: () => ({ count: 5 }) } }]);
        }
        if (sql.includes('COUNT(*) as count FROM weight_registrations')) {
          return Promise.resolve([{ rows: { item: () => ({ count: 10 }) } }]);
        }
        if (sql.includes('COUNT(*) as count FROM sync_queue')) {
          return Promise.resolve([{ rows: { item: () => ({ count: 3 }) } }]);
        }
        return Promise.resolve([{ rows: { item: () => ({ count: 0 }) } }]);
      });

      const stats = await storageService.getDatabaseStats();

      expect(stats).toEqual({
        registrationsCount: 10,
        pendingSyncCount: 5,
        queueCount: 3,
        databaseSize: 0,
      });
    });

    it('should handle statistics query errors gracefully', async () => {
      mockDatabase.executeSql.mockRejectedValue(new Error('Stats query failed'));

      await expect(storageService.getDatabaseStats()).rejects.toThrow('Stats query failed');
    });
  });

  describe('Data Cleanup', () => {
    beforeEach(async () => {
      mockDatabase.executeSql.mockImplementation((sql: string) => {
        if (sql.includes('PRAGMA user_version')) {
          return Promise.resolve([{ rows: { item: () => ({ user_version: 1 }) } }]);
        }
        return Promise.resolve([]);
      });
      
      await storageService.initializeDatabase();
      jest.clearAllMocks();
    });

    it('should clean up old data', async () => {
      const mockTransaction = {
        executeSql: jest.fn().mockResolvedValue([]),
      };
      
      mockDatabase.transaction.mockImplementation(
        (callback: (tx: any) => Promise<void>) => callback(mockTransaction)
      );

      await storageService.cleanupOldData();

      expect(mockDatabase.transaction).toHaveBeenCalled();
      expect(mockTransaction.executeSql).toHaveBeenCalledTimes(2);
    });

    it('should handle cleanup errors', async () => {
      mockDatabase.transaction.mockRejectedValue(new Error('Cleanup failed'));

      await expect(storageService.cleanupOldData()).rejects.toThrow('Cleanup failed');
    });
  });

  describe('Database Connection Management', () => {
    it('should close database connection', async () => {
      await storageService.initializeDatabase();
      
      await storageService.closeDatabase();

      expect(mockDatabase.close).toHaveBeenCalled();
    });

    it('should handle close errors gracefully', async () => {
      await storageService.initializeDatabase();
      mockDatabase.close.mockRejectedValue(new Error('Close error'));

      await expect(storageService.closeDatabase()).rejects.toThrow('Close error');
    });

    it('should handle close when no database is open', async () => {
      await expect(storageService.closeDatabase()).resolves.not.toThrow();
    });
  });
});