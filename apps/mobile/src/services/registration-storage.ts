/**
 * Registration Storage Service
 * CRUD operations for weight registrations in offline database
 */

import uuid from 'react-native-uuid';
import OfflineStorageService from './offline-storage';
import {
  LocalWeightRegistration,
  CreateRegistrationPayload,
  SyncStatus,
  WEIGHT_VALIDATION,
  CUT_TYPES,
} from '../types/offline';

class RegistrationStorageService {
  private static instance: RegistrationStorageService;
  private storageService: OfflineStorageService;

  constructor() {
    this.storageService = OfflineStorageService.getInstance();
  }

  public static getInstance(): RegistrationStorageService {
    if (!RegistrationStorageService.instance) {
      RegistrationStorageService.instance = new RegistrationStorageService();
    }
    return RegistrationStorageService.instance;
  }

  /**
   * Create a new registration in local storage
   */
  public async createRegistration(
    payload: CreateRegistrationPayload
  ): Promise<LocalWeightRegistration> {
    this.validateRegistrationData(payload);

    const id = uuid.v4() as string;
    const now = new Date().toISOString();

    const registration: LocalWeightRegistration = {
      id,
      weight: payload.weight,
      cut_type: payload.cut_type,
      supplier: payload.supplier,
      local_photo_path: payload.local_photo_path,
      sync_status: 'pending',
      registered_by: payload.registered_by,
      created_at: now,
      updated_at: now,
    };

    try {
      await this.storageService.executeQuery(
        `INSERT INTO weight_registrations 
         (id, weight, cut_type, supplier, local_photo_path, sync_status, 
          registered_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          registration.id,
          registration.weight,
          registration.cut_type,
          registration.supplier,
          registration.local_photo_path || null,
          registration.sync_status,
          registration.registered_by,
          registration.created_at,
          registration.updated_at,
        ]
      );

      console.log('✅ Registration created locally:', registration.id);
      return registration;
    } catch (error) {
      console.error('❌ Failed to create registration:', error);
      throw new Error(`Failed to create registration: ${error}`);
    }
  }

  /**
   * Get registration by ID
   */
  public async getRegistrationById(id: string): Promise<LocalWeightRegistration | null> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM weight_registrations WHERE id = ?',
        [id]
      );

      if (results.length === 0) {
        return null;
      }

      return this.mapDatabaseRowToRegistration(results[0]);
    } catch (error) {
      console.error('❌ Failed to get registration by ID:', error);
      throw error;
    }
  }

  /**
   * Get registrations with pagination and filtering
   */
  public async getRegistrations(options?: {
    limit?: number;
    offset?: number;
    syncStatus?: SyncStatus;
    registeredBy?: string;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<LocalWeightRegistration[]> {
    try {
      let sql = 'SELECT * FROM weight_registrations WHERE 1=1';
      const params: any[] = [];

      // Add filters
      if (options?.syncStatus) {
        sql += ' AND sync_status = ?';
        params.push(options.syncStatus);
      }

      if (options?.registeredBy) {
        sql += ' AND registered_by = ?';
        params.push(options.registeredBy);
      }

      if (options?.dateFrom) {
        sql += ' AND created_at >= ?';
        params.push(options.dateFrom);
      }

      if (options?.dateTo) {
        sql += ' AND created_at <= ?';
        params.push(options.dateTo);
      }

      // Add ordering and pagination
      sql += ' ORDER BY created_at DESC';

      if (options?.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          sql += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      const results = await this.storageService.executeQuery(sql, params);
      return results.map(row => this.mapDatabaseRowToRegistration(row));
    } catch (error) {
      console.error('❌ Failed to get registrations:', error);
      throw error;
    }
  }

  /**
   * Get today's registrations
   */
  public async getTodayRegistrations(): Promise<LocalWeightRegistration[]> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getRegistrations({
      dateFrom: today.toISOString(),
      dateTo: tomorrow.toISOString(),
    });
  }

  /**
   * Get pending sync registrations
   */
  public async getPendingSyncRegistrations(): Promise<LocalWeightRegistration[]> {
    return this.getRegistrations({ syncStatus: 'pending' });
  }

  /**
   * Update registration sync status
   */
  public async updateSyncStatus(
    id: string,
    syncStatus: SyncStatus,
    photoUrl?: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      let sql = 'UPDATE weight_registrations SET sync_status = ?, updated_at = ?';
      const params: any[] = [syncStatus, now];

      if (photoUrl) {
        sql += ', photo_url = ?';
        params.push(photoUrl);
      }

      sql += ' WHERE id = ?';
      params.push(id);

      await this.storageService.executeQuery(sql, params);
      console.log(`✅ Registration ${id} sync status updated to ${syncStatus}`);
    } catch (error) {
      console.error('❌ Failed to update sync status:', error);
      throw error;
    }
  }

  /**
   * Update OCR confidence for a registration
   */
  public async updateOcrConfidence(id: string, confidence: number): Promise<void> {
    if (confidence < 0 || confidence > 1) {
      throw new Error('OCR confidence must be between 0 and 1');
    }

    try {
      await this.storageService.executeQuery(
        'UPDATE weight_registrations SET ocr_confidence = ?, updated_at = ? WHERE id = ?',
        [confidence, new Date().toISOString(), id]
      );
      console.log(`✅ OCR confidence updated for registration ${id}`);
    } catch (error) {
      console.error('❌ Failed to update OCR confidence:', error);
      throw error;
    }
  }

  /**
   * Delete registration (soft delete by changing sync status)
   */
  public async deleteRegistration(id: string): Promise<void> {
    try {
      await this.storageService.executeQuery(
        'UPDATE weight_registrations SET sync_status = ? WHERE id = ?',
        ['failed', id]
      );
      console.log(`✅ Registration ${id} marked for deletion`);
    } catch (error) {
      console.error('❌ Failed to delete registration:', error);
      throw error;
    }
  }

  /**
   * Get registration statistics
   */
  public async getRegistrationStats(): Promise<{
    total: number;
    pending: number;
    synced: number;
    failed: number;
    todayCount: number;
  }> {
    try {
      const [total, pending, synced, failed, today] = await Promise.all([
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM weight_registrations'),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM weight_registrations WHERE sync_status = ?', ['pending']),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM weight_registrations WHERE sync_status = ?', ['synced']),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM weight_registrations WHERE sync_status = ?', ['failed']),
        this.getTodayRegistrations(),
      ]);

      return {
        total: total[0]?.count || 0,
        pending: pending[0]?.count || 0,
        synced: synced[0]?.count || 0,
        failed: failed[0]?.count || 0,
        todayCount: today.length,
      };
    } catch (error) {
      console.error('❌ Failed to get registration stats:', error);
      throw error;
    }
  }

  /**
   * Validate registration data
   */
  private validateRegistrationData(payload: CreateRegistrationPayload): void {
    if (!payload.weight || payload.weight < WEIGHT_VALIDATION.min || payload.weight > WEIGHT_VALIDATION.max) {
      throw new Error(`Weight must be between ${WEIGHT_VALIDATION.min} and ${WEIGHT_VALIDATION.max}`);
    }

    if (!CUT_TYPES.includes(payload.cut_type)) {
      throw new Error(`Cut type must be one of: ${CUT_TYPES.join(', ')}`);
    }

    if (!payload.supplier || payload.supplier.trim().length === 0) {
      throw new Error('Supplier is required');
    }

    if (!payload.registered_by) {
      throw new Error('Registered by user ID is required');
    }
  }

  /**
   * Map database row to registration object
   */
  private mapDatabaseRowToRegistration(row: any): LocalWeightRegistration {
    return {
      id: row.id,
      weight: parseFloat(row.weight),
      cut_type: row.cut_type,
      supplier: row.supplier,
      photo_url: row.photo_url,
      local_photo_path: row.local_photo_path,
      ocr_confidence: row.ocr_confidence ? parseFloat(row.ocr_confidence) : undefined,
      sync_status: row.sync_status,
      registered_by: row.registered_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }
}

export default RegistrationStorageService;