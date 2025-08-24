/**
 * User Storage Service
 * Local user session management and caching for offline functionality
 */

import OfflineStorageService from './offline-storage';
import { LocalUser, USER_ROLES } from '../types/offline';

class UserStorageService {
  private static instance: UserStorageService;
  private storageService: OfflineStorageService;

  constructor() {
    this.storageService = OfflineStorageService.getInstance();
  }

  public static getInstance(): UserStorageService {
    if (!UserStorageService.instance) {
      UserStorageService.instance = new UserStorageService();
    }
    return UserStorageService.instance;
  }

  /**
   * Cache user data locally
   */
  public async cacheUser(user: LocalUser): Promise<void> {
    this.validateUserData(user);

    try {
      // Use INSERT OR REPLACE to handle both new users and updates
      await this.storageService.executeQuery(
        `INSERT OR REPLACE INTO users 
         (id, name, role, active, created_at, last_login)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          user.name,
          user.role,
          user.active ? 1 : 0,
          user.created_at,
          user.last_login || null,
        ]
      );

      console.log('✅ User cached locally:', user.name);
    } catch (error) {
      console.error('❌ Failed to cache user:', error);
      throw new Error(`Failed to cache user: ${error}`);
    }
  }

  /**
   * Get user by ID
   */
  public async getUserById(id: string): Promise<LocalUser | null> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM users WHERE id = ?',
        [id]
      );

      if (results.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToUser(results[0]);
    } catch (error) {
      console.error('❌ Failed to get user by ID:', error);
      throw error;
    }
  }

  /**
   * Get user by name
   */
  public async getUserByName(name: string): Promise<LocalUser | null> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM users WHERE name = ?',
        [name]
      );

      if (results.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToUser(results[0]);
    } catch (error) {
      console.error('❌ Failed to get user by name:', error);
      throw error;
    }
  }

  /**
   * Get all active users
   */
  public async getActiveUsers(): Promise<LocalUser[]> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM users WHERE active = 1 ORDER BY name ASC'
      );

      return results.map(row => this.mapDatabaseRowToUser(row));
    } catch (error) {
      console.error('❌ Failed to get active users:', error);
      throw error;
    }
  }

  /**
   * Get users by role
   */
  public async getUsersByRole(role: 'operator' | 'supervisor'): Promise<LocalUser[]> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM users WHERE role = ? AND active = 1 ORDER BY name ASC',
        [role]
      );

      return results.map(row => this.mapDatabaseRowToUser(row));
    } catch (error) {
      console.error('❌ Failed to get users by role:', error);
      throw error;
    }
  }

  /**
   * Update user's last login time
   */
  public async updateLastLogin(userId: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      await this.storageService.executeQuery(
        'UPDATE users SET last_login = ? WHERE id = ?',
        [now, userId]
      );

      console.log(`✅ Updated last login for user ${userId}`);
    } catch (error) {
      console.error('❌ Failed to update last login:', error);
      throw error;
    }
  }

  /**
   * Deactivate user (soft delete)
   */
  public async deactivateUser(userId: string): Promise<void> {
    try {
      await this.storageService.executeQuery(
        'UPDATE users SET active = 0 WHERE id = ?',
        [userId]
      );

      console.log(`✅ User ${userId} deactivated`);
    } catch (error) {
      console.error('❌ Failed to deactivate user:', error);
      throw error;
    }
  }

  /**
   * Check if user exists locally
   */
  public async userExists(userId: string): Promise<boolean> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT COUNT(*) as count FROM users WHERE id = ?',
        [userId]
      );

      return results[0]?.count > 0;
    } catch (error) {
      console.error('❌ Failed to check user existence:', error);
      return false;
    }
  }

  /**
   * Get user statistics
   */
  public async getUserStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    operators: number;
    supervisors: number;
  }> {
    try {
      const [total, active, operators, supervisors] = await Promise.all([
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM users'),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM users WHERE active = 1'),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM users WHERE role = ? AND active = 1', ['operator']),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM users WHERE role = ? AND active = 1', ['supervisor']),
      ]);

      return {
        totalUsers: total[0]?.count || 0,
        activeUsers: active[0]?.count || 0,
        operators: operators[0]?.count || 0,
        supervisors: supervisors[0]?.count || 0,
      };
    } catch (error) {
      console.error('❌ Failed to get user stats:', error);
      throw error;
    }
  }

  /**
   * Clear all cached users (for logout/reset scenarios)
   */
  public async clearUserCache(): Promise<void> {
    try {
      await this.storageService.executeQuery('DELETE FROM users');
      console.log('✅ User cache cleared');
    } catch (error) {
      console.error('❌ Failed to clear user cache:', error);
      throw error;
    }
  }

  /**
   * Cache multiple users in batch
   */
  public async cacheUsersInBatch(users: LocalUser[]): Promise<void> {
    try {
      const operations = users.map(user => ({
        sql: `INSERT OR REPLACE INTO users 
              (id, name, role, active, created_at, last_login)
              VALUES (?, ?, ?, ?, ?, ?)`,
        params: [
          user.id,
          user.name,
          user.role,
          user.active ? 1 : 0,
          user.created_at,
          user.last_login || null,
        ],
      }));

      await this.storageService.executeTransaction(operations);
      console.log(`✅ Cached ${users.length} users in batch`);
    } catch (error) {
      console.error('❌ Failed to cache users in batch:', error);
      throw error;
    }
  }

  /**
   * Validate user data
   */
  private validateUserData(user: LocalUser): void {
    if (!user.id || user.id.trim().length === 0) {
      throw new Error('User ID is required');
    }

    if (!user.name || user.name.trim().length === 0) {
      throw new Error('User name is required');
    }

    if (!USER_ROLES.includes(user.role)) {
      throw new Error(`User role must be one of: ${USER_ROLES.join(', ')}`);
    }

    if (!user.created_at) {
      throw new Error('User created_at timestamp is required');
    }
  }

  /**
   * Map database row to user object
   */
  private mapDatabaseRowToUser(row: any): LocalUser {
    return {
      id: row.id,
      name: row.name,
      role: row.role,
      active: Boolean(row.active),
      created_at: row.created_at,
      last_login: row.last_login || undefined,
    };
  }
}

export default UserStorageService;