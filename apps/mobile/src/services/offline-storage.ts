/**
 * Offline Storage Service
 * Manages SQLite database operations for offline functionality
 */

import SQLite, { DatabaseParams, SQLiteDatabase } from 'react-native-sqlite-storage';
import { ALL_CREATE_STATEMENTS, DATABASE_VERSION } from '../utils/database-schema';

// Enable debugging in development
if (__DEV__) {
  SQLite.DEBUG(true);
  SQLite.enablePromise(true);
}

class OfflineStorageService {
  private static instance: OfflineStorageService;
  private database: SQLiteDatabase | null = null;
  private readonly databaseName = 'meat_reception_offline.db';
  private readonly databaseLocation = 'default';

  public static getInstance(): OfflineStorageService {
    if (!OfflineStorageService.instance) {
      OfflineStorageService.instance = new OfflineStorageService();
    }
    return OfflineStorageService.instance;
  }

  /**
   * Initialize database connection and create tables
   */
  public async initializeDatabase(): Promise<void> {
    try {
      if (this.database) {
        await this.database.close();
      }

      const databaseParams: DatabaseParams = {
        name: this.databaseName,
        location: this.databaseLocation,
      };

      this.database = await SQLite.openDatabase(databaseParams);
      
      // Check database version and perform migrations if needed
      await this.checkAndMigrateDatabase();
      
      console.log('✅ SQLite database initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize SQLite database:', error);
      throw new Error(`Database initialization failed: ${error}`);
    }
  }

  /**
   * Get database connection
   */
  public getDatabase(): SQLiteDatabase {
    if (!this.database) {
      throw new Error('Database not initialized. Call initializeDatabase() first.');
    }
    return this.database;
  }

  /**
   * Check database version and perform migrations
   */
  private async checkAndMigrateDatabase(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    try {
      // Get current database version
      const versionResult = await this.database.executeSql(
        'PRAGMA user_version'
      );
      const currentVersion = versionResult[0].rows.item(0).user_version;

      if (currentVersion === 0) {
        // First time setup - create all tables
        await this.createTables();
        await this.database.executeSql(`PRAGMA user_version = ${DATABASE_VERSION}`);
        console.log('✅ Database tables created');
      } else if (currentVersion < DATABASE_VERSION) {
        // Future migrations would go here
        console.log(`🔄 Database migration needed from v${currentVersion} to v${DATABASE_VERSION}`);
        // await this.performMigration(currentVersion, DATABASE_VERSION);
      }
    } catch (error) {
      console.error('❌ Database migration failed:', error);
      throw error;
    }
  }

  /**
   * Create database tables
   */
  private async createTables(): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    try {
      for (const statement of ALL_CREATE_STATEMENTS) {
        await this.database.executeSql(statement);
      }
      console.log('✅ All database tables created successfully');
    } catch (error) {
      console.error('❌ Failed to create tables:', error);
      throw error;
    }
  }

  /**
   * Execute a raw SQL query with parameters
   */
  public async executeQuery(
    sql: string,
    params: any[] = []
  ): Promise<any[]> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    try {
      const result = await this.database.executeSql(sql, params);
      const rows = result[0].rows;
      const items = [];
      
      for (let i = 0; i < rows.length; i++) {
        items.push(rows.item(i));
      }
      
      return items;
    } catch (error) {
      console.error('❌ Query execution failed:', sql, params, error);
      throw error;
    }
  }

  /**
   * Execute a transaction for multiple operations
   */
  public async executeTransaction(
    operations: Array<{ sql: string; params?: any[] }>
  ): Promise<void> {
    if (!this.database) {
      throw new Error('Database not initialized');
    }

    try {
      await this.database.transaction(async (tx) => {
        for (const operation of operations) {
          await tx.executeSql(operation.sql, operation.params || []);
        }
      });
    } catch (error) {
      console.error('❌ Transaction failed:', error);
      throw error;
    }
  }

  /**
   * Clean up old data based on retention policies
   */
  public async cleanupOldData(): Promise<void> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    try {
      await this.executeTransaction([
        {
          sql: `DELETE FROM weight_registrations 
                WHERE sync_status = 'synced' AND created_at < ?`,
          params: [cutoffDate],
        },
        {
          sql: `DELETE FROM sync_queue 
                WHERE created_at < ? AND error_message IS NULL`,
          params: [cutoffDate],
        },
      ]);
      console.log('✅ Old data cleanup completed');
    } catch (error) {
      console.error('❌ Data cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  public async getDatabaseStats(): Promise<{
    registrationsCount: number;
    pendingSyncCount: number;
    queueCount: number;
    databaseSize: number;
  }> {
    try {
      const [registrations, pendingSync, queue] = await Promise.all([
        this.executeQuery('SELECT COUNT(*) as count FROM weight_registrations'),
        this.executeQuery(`SELECT COUNT(*) as count FROM weight_registrations 
                          WHERE sync_status != 'synced'`),
        this.executeQuery('SELECT COUNT(*) as count FROM sync_queue'),
      ]);

      return {
        registrationsCount: registrations[0]?.count || 0,
        pendingSyncCount: pendingSync[0]?.count || 0,
        queueCount: queue[0]?.count || 0,
        databaseSize: 0, // Would need platform-specific implementation
      };
    } catch (error) {
      console.error('❌ Failed to get database stats:', error);
      throw error;
    }
  }

  /**
   * Close database connection
   */
  public async closeDatabase(): Promise<void> {
    try {
      if (this.database) {
        await this.database.close();
        this.database = null;
        console.log('✅ Database connection closed');
      }
    } catch (error) {
      console.error('❌ Failed to close database:', error);
      throw error;
    }
  }
}

export default OfflineStorageService;