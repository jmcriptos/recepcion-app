/**
 * Sync Queue Management Service
 * Handles offline operation queuing and background synchronization
 */

import uuid from 'react-native-uuid';
import OfflineStorageService from './offline-storage';
import { apiClient } from './api-client';
import ConflictResolutionService from '../utils/conflict-resolution';
import {
  SyncQueueItem,
  OperationType,
  CreateRegistrationPayload,
  UploadPhotoPayload,
  UpdateUserPayload,
  SyncProgress,
  LocalWeightRegistration,
} from '../types/offline';
import { validateSyncPayload } from '../utils/data-validation';

class SyncQueueService {
  private static instance: SyncQueueService;
  private storageService: OfflineStorageService;
  private conflictResolver: ConflictResolutionService;
  private isProcessing: boolean = false;
  private processingCallbacks: Array<(progress: SyncProgress) => void> = [];
  
  // Priority levels
  private readonly PRIORITY_LEVELS = {
    create_registration: 1,
    update_user: 2,
    upload_photo: 3,
  };

  // Retry configuration
  private readonly MAX_RETRIES = 5;
  private readonly RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000]; // Exponential backoff

  constructor() {
    this.storageService = OfflineStorageService.getInstance();
    this.conflictResolver = ConflictResolutionService.getInstance();
  }

  public static getInstance(): SyncQueueService {
    if (!SyncQueueService.instance) {
      SyncQueueService.instance = new SyncQueueService();
    }
    return SyncQueueService.instance;
  }

  /**
   * Add registration creation to sync queue
   */
  public async queueRegistrationCreation(
    payload: CreateRegistrationPayload,
    registrationId: string
  ): Promise<void> {
    await this.addToQueue(
      'create_registration',
      registrationId,
      JSON.stringify(payload)
    );
  }

  /**
   * Add photo upload to sync queue
   */
  public async queuePhotoUpload(
    payload: UploadPhotoPayload,
    photoId: string
  ): Promise<void> {
    await this.addToQueue(
      'upload_photo',
      photoId,
      JSON.stringify(payload)
    );
  }

  /**
   * Add user update to sync queue
   */
  public async queueUserUpdate(
    payload: UpdateUserPayload,
    userId: string
  ): Promise<void> {
    await this.addToQueue(
      'update_user',
      userId,
      JSON.stringify(payload)
    );
  }

  /**
   * Add operation to sync queue
   */
  private async addToQueue(
    operationType: OperationType,
    entityId: string,
    payload: string
  ): Promise<void> {
    const validation = validateSyncPayload(payload, operationType);
    if (!validation.isValid) {
      throw new Error(`Invalid sync payload: ${validation.errors.join(', ')}`);
    }

    const queueItem: SyncQueueItem = {
      id: uuid.v4() as string,
      operation_type: operationType,
      entity_id: entityId,
      payload,
      priority: this.PRIORITY_LEVELS[operationType],
      retry_count: 0,
      created_at: new Date().toISOString(),
    };

    try {
      await this.storageService.executeQuery(
        `INSERT INTO sync_queue 
         (id, operation_type, entity_id, payload, priority, retry_count, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          queueItem.id,
          queueItem.operation_type,
          queueItem.entity_id,
          queueItem.payload,
          queueItem.priority,
          queueItem.retry_count,
          queueItem.created_at,
        ]
      );

      console.log(`✅ Added ${operationType} to sync queue: ${entityId}`);
    } catch (error) {
      console.error('❌ Failed to add to sync queue:', error);
      throw new Error(`Failed to add to sync queue: ${error}`);
    }
  }

  /**
   * Get pending sync operations ordered by priority
   */
  public async getPendingOperations(limit: number = 10): Promise<SyncQueueItem[]> {
    try {
      const results = await this.storageService.executeQuery(
        `SELECT * FROM sync_queue 
         WHERE retry_count < ? 
         ORDER BY priority ASC, created_at ASC 
         LIMIT ?`,
        [this.MAX_RETRIES, limit]
      );

      return results.map(row => this.mapDatabaseRowToQueueItem(row));
    } catch (error) {
      console.error('❌ Failed to get pending operations:', error);
      throw error;
    }
  }

  /**
   * Mark operation as completed and remove from queue
   */
  public async markCompleted(queueItemId: string): Promise<void> {
    try {
      await this.storageService.executeQuery(
        'DELETE FROM sync_queue WHERE id = ?',
        [queueItemId]
      );
      console.log(`✅ Sync operation completed: ${queueItemId}`);
    } catch (error) {
      console.error('❌ Failed to mark operation as completed:', error);
      throw error;
    }
  }

  /**
   * Mark operation as failed and update retry count
   */
  public async markFailed(
    queueItemId: string,
    errorMessage: string
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      await this.storageService.executeQuery(
        `UPDATE sync_queue 
         SET retry_count = retry_count + 1, 
             last_attempt_at = ?, 
             error_message = ?
         WHERE id = ?`,
        [now, errorMessage, queueItemId]
      );
      
      console.log(`⚠️ Sync operation failed: ${queueItemId} - ${errorMessage}`);
    } catch (error) {
      console.error('❌ Failed to mark operation as failed:', error);
      throw error;
    }
  }

  /**
   * Process sync queue
   */
  public async processQueue(
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncProgress> {
    if (this.isProcessing) {
      console.log('⚠️ Sync queue is already being processed');
      return { total: 0, completed: 0, failed: 0 };
    }

    this.isProcessing = true;
    
    try {
      const pendingOperations = await this.getPendingOperations(50);
      
      if (pendingOperations.length === 0) {
        console.log('✅ No pending sync operations');
        return { total: 0, completed: 0, failed: 0 };
      }

      console.log(`🔄 Processing ${pendingOperations.length} sync operations`);
      
      let completed = 0;
      let failed = 0;

      for (const operation of pendingOperations) {
        try {
          const progress: SyncProgress = {
            total: pendingOperations.length,
            completed,
            failed,
            currentOperation: `${operation.operation_type}:${operation.entity_id}`,
          };

          if (onProgress) {
            onProgress(progress);
          }

          await this.processOperation(operation);
          await this.markCompleted(operation.id);
          completed++;

          console.log(`✅ Processed: ${operation.operation_type}:${operation.entity_id}`);
          
        } catch (error) {
          console.error(`❌ Failed to process: ${operation.operation_type}:${operation.entity_id}`, error);
          await this.markFailed(operation.id, String(error));
          failed++;

          // If max retries reached, this operation won't be retried
          if (operation.retry_count >= this.MAX_RETRIES - 1) {
            console.error(`❌ Max retries reached for: ${operation.id}`);
          }
        }

        // Small delay between operations to prevent overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const finalProgress: SyncProgress = {
        total: pendingOperations.length,
        completed,
        failed,
      };

      console.log(`✅ Sync completed: ${completed} successful, ${failed} failed`);
      return finalProgress;

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process individual sync operation
   */
  private async processOperation(operation: SyncQueueItem): Promise<void> {
    const payload = JSON.parse(operation.payload);

    switch (operation.operation_type) {
      case 'create_registration':
        await this.processRegistrationCreation(payload, operation.entity_id);
        break;
      case 'upload_photo':
        await this.processPhotoUpload(payload);
        break;
      case 'update_user':
        await this.processUserUpdate(payload);
        break;
      default:
        throw new Error(`Unknown operation type: ${operation.operation_type}`);
    }
  }

  /**
   * Process registration creation with conflict detection
   */
  private async processRegistrationCreation(
    payload: CreateRegistrationPayload,
    registrationId: string
  ): Promise<void> {
    console.log('📤 Creating registration on server:', registrationId);
    
    try {
      // Validate session before sync
      const sessionValid = await apiClient.validateSession();
      if (!sessionValid) {
        throw new Error('Session expired - please login again');
      }

      // Get current local registration data
      const localRegistration = await this.getLocalRegistration(registrationId);
      if (!localRegistration) {
        throw new Error(`Local registration not found: ${registrationId}`);
      }

      // Check if registration already exists on server (conflict detection)
      const existingServerRegistration = await apiClient.getRegistrationById(registrationId);
      
      if (existingServerRegistration) {
        console.log('⚠️ Registration already exists on server, checking for conflicts...');
        
        // Detect conflicts
        const conflict = this.conflictResolver.detectRegistrationConflicts(
          localRegistration,
          existingServerRegistration
        );
        
        if (conflict) {
          console.log(`🔄 Conflict detected for registration ${registrationId}`);
          
          // Get recommended resolution strategy
          const strategy = this.conflictResolver.getRecommendedStrategy(conflict);
          
          // Resolve conflict
          const resolution = this.conflictResolver.resolveRegistrationConflict(conflict, strategy);
          
          // Log the resolution
          this.conflictResolver.logConflictResolution(conflict, resolution);
          
          // Update local data with resolved data
          await this.updateLocalRegistrationWithResolution(registrationId, resolution.resolvedData);
          
          console.log(`✅ Conflict resolved for registration ${registrationId} using strategy: ${strategy}`);
        } else {
          // No conflicts, just update sync status
          await this.updateRegistrationSyncStatus(registrationId, 'synced', existingServerRegistration);
        }
      } else {
        // Create new registration on server
        const serverRegistration = await apiClient.createRegistration(payload);
        
        // Update local registration with server response
        await this.updateRegistrationSyncStatus(registrationId, 'synced', serverRegistration);
        
        console.log('✅ New registration created on server:', registrationId);
      }
      
    } catch (error) {
      console.error('❌ Registration sync failed:', error);
      
      // Update local status to failed
      await this.updateRegistrationSyncStatus(registrationId, 'failed');
      
      throw error;
    }
  }

  /**
   * Get local registration by ID
   */
  private async getLocalRegistration(registrationId: string): Promise<LocalWeightRegistration | null> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM weight_registrations WHERE id = ?',
        [registrationId]
      );
      
      if (results.length === 0) {
        return null;
      }
      
      const row = results[0];
      return {
        id: row.id,
        weight: row.weight,
        cut_type: row.cut_type,
        supplier: row.supplier,
        photo_url: row.photo_url,
        local_photo_path: row.local_photo_path,
        ocr_confidence: row.ocr_confidence,
        sync_status: row.sync_status,
        registered_by: row.registered_by,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };
    } catch (error) {
      console.error('❌ Failed to get local registration:', error);
      return null;
    }
  }

  /**
   * Update local registration with resolved data
   */
  private async updateLocalRegistrationWithResolution(
    registrationId: string,
    resolvedData: LocalWeightRegistration
  ): Promise<void> {
    await this.storageService.executeQuery(
      `UPDATE weight_registrations 
       SET weight = ?, 
           cut_type = ?, 
           supplier = ?, 
           photo_url = ?, 
           ocr_confidence = ?,
           sync_status = 'synced',
           updated_at = ?
       WHERE id = ?`,
      [
        resolvedData.weight,
        resolvedData.cut_type,
        resolvedData.supplier,
        resolvedData.photo_url,
        resolvedData.ocr_confidence,
        new Date().toISOString(),
        registrationId,
      ]
    );
  }

  /**
   * Update registration sync status and metadata
   */
  private async updateRegistrationSyncStatus(
    registrationId: string,
    syncStatus: 'synced' | 'failed',
    serverData?: any
  ): Promise<void> {
    if (syncStatus === 'synced' && serverData) {
      await this.storageService.executeQuery(
        `UPDATE weight_registrations 
         SET sync_status = ?, 
             photo_url = ?, 
             ocr_confidence = ?,
             updated_at = ?
         WHERE id = ?`,
        [
          syncStatus,
          serverData.photo_url || null,
          serverData.ocr_confidence || null,
          new Date().toISOString(),
          registrationId,
        ]
      );
    } else {
      await this.storageService.executeQuery(
        `UPDATE weight_registrations 
         SET sync_status = ?, 
             updated_at = ?
         WHERE id = ?`,
        [syncStatus, new Date().toISOString(), registrationId]
      );
    }
  }

  /**
   * Process photo upload
   */
  private async processPhotoUpload(payload: UploadPhotoPayload): Promise<void> {
    console.log('📤 Uploading photo to server:', payload.registration_id);
    
    try {
      // Validate session before sync
      const sessionValid = await apiClient.validateSession();
      if (!sessionValid) {
        throw new Error('Session expired - please login again');
      }

      // Upload photo to server for OCR processing
      const uploadResult = await apiClient.uploadPhoto(payload);
      
      // Update local registration with photo URL and OCR results
      await this.storageService.executeQuery(
        `UPDATE weight_registrations 
         SET photo_url = ?, 
             ocr_confidence = ?,
             sync_status = 'synced',
             updated_at = ?
         WHERE id = ?`,
        [
          uploadResult.photo_url,
          uploadResult.ocr_result?.confidence || null,
          new Date().toISOString(),
          payload.registration_id,
        ]
      );
      
      // If OCR detected weight, update registration weight
      if (uploadResult.ocr_result?.weight) {
        await this.storageService.executeQuery(
          `UPDATE weight_registrations 
           SET weight = ?
           WHERE id = ?`,
          [uploadResult.ocr_result.weight, payload.registration_id]
        );
      }
      
      console.log('✅ Photo uploaded to server:', payload.registration_id);
    } catch (error) {
      console.error('❌ Photo upload failed:', error);
      
      // Update local status to failed
      await this.storageService.executeQuery(
        `UPDATE weight_registrations 
         SET sync_status = 'failed', 
             updated_at = ?
         WHERE id = ?`,
        [new Date().toISOString(), payload.registration_id]
      );
      
      throw error;
    }
  }

  /**
   * Process user update
   */
  private async processUserUpdate(payload: UpdateUserPayload): Promise<void> {
    console.log('📤 Updating user on server:', payload.user_id);
    
    try {
      // Validate session before sync
      const sessionValid = await apiClient.validateSession();
      if (!sessionValid) {
        throw new Error('Session expired - please login again');
      }

      // Update user on server
      const updateResult = await apiClient.updateUser(payload);
      
      // Update local user record if needed
      await this.storageService.executeQuery(
        `UPDATE users 
         SET last_login = ?, updated_at = ?
         WHERE id = ?`,
        [
          updateResult.last_login,
          new Date().toISOString(),
          payload.user_id,
        ]
      );
      
      console.log('✅ User updated on server:', payload.user_id);
    } catch (error) {
      console.error('❌ User update failed:', error);
      throw error;
    }
  }

  /**
   * Process sync queue with batch optimization
   */
  public async processBatchSync(
    batchSize: number = 10,
    onProgress?: (progress: SyncProgress) => void
  ): Promise<SyncProgress> {
    if (this.isProcessing) {
      console.log('⚠️ Sync queue is already being processed');
      return { total: 0, completed: 0, failed: 0 };
    }

    this.isProcessing = true;
    
    try {
      let totalProcessed = 0;
      let totalCompleted = 0;
      let totalFailed = 0;
      let hasMoreItems = true;

      while (hasMoreItems) {
        // Get next batch of operations
        const pendingOperations = await this.getPendingOperations(batchSize);
        
        if (pendingOperations.length === 0) {
          hasMoreItems = false;
          continue;
        }

        console.log(`🔄 Processing batch of ${pendingOperations.length} sync operations`);
        
        // Group operations by type for more efficient processing
        const operationsByType = this.groupOperationsByType(pendingOperations);
        
        // Process each type in priority order
        for (const [operationType, operations] of operationsByType) {
          for (const operation of operations) {
            try {
              const progress: SyncProgress = {
                total: pendingOperations.length,
                completed: totalCompleted,
                failed: totalFailed,
                currentOperation: `${operation.operation_type}:${operation.entity_id}`,
              };

              if (onProgress) {
                onProgress(progress);
              }

              await this.processOperation(operation);
              await this.markCompleted(operation.id);
              totalCompleted++;

              console.log(`✅ Processed: ${operation.operation_type}:${operation.entity_id}`);
              
            } catch (error) {
              console.error(`❌ Failed to process: ${operation.operation_type}:${operation.entity_id}`, error);
              await this.markFailed(operation.id, String(error));
              totalFailed++;

              // If max retries reached, this operation won't be retried
              if (operation.retry_count >= this.MAX_RETRIES - 1) {
                console.error(`❌ Max retries reached for: ${operation.id}`);
              }
            }

            // Small delay between operations
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          // Longer delay between operation types
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        totalProcessed += pendingOperations.length;
        
        // Check if there are more items to process
        const remainingItems = await this.getPendingOperations(1);
        hasMoreItems = remainingItems.length > 0;
        
        // Break if we've processed a reasonable amount in one session
        if (totalProcessed >= 100) {
          console.log('⏸️ Processed maximum batch size, will continue in next sync cycle');
          break;
        }
      }

      const finalProgress: SyncProgress = {
        total: totalProcessed,
        completed: totalCompleted,
        failed: totalFailed,
      };

      console.log(`✅ Batch sync completed: ${totalCompleted} successful, ${totalFailed} failed`);
      return finalProgress;

    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Group operations by type for batch processing efficiency
   */
  private groupOperationsByType(operations: SyncQueueItem[]): Map<OperationType, SyncQueueItem[]> {
    const groups = new Map<OperationType, SyncQueueItem[]>();
    
    for (const operation of operations) {
      if (!groups.has(operation.operation_type)) {
        groups.set(operation.operation_type, []);
      }
      groups.get(operation.operation_type)!.push(operation);
    }
    
    // Return in priority order
    const priorityOrder: OperationType[] = ['create_registration', 'upload_photo', 'update_user'];
    const sortedGroups = new Map<OperationType, SyncQueueItem[]>();
    
    for (const type of priorityOrder) {
      if (groups.has(type)) {
        sortedGroups.set(type, groups.get(type)!);
      }
    }
    
    return sortedGroups;
  }

  /**
   * Rollback failed sync operation
   */
  public async rollbackFailedOperation(queueItemId: string): Promise<void> {
    try {
      // Get the failed queue item
      const queueItem = await this.getQueueItemById(queueItemId);
      if (!queueItem) {
        throw new Error(`Queue item not found: ${queueItemId}`);
      }

      console.log(`🔄 Rolling back failed operation: ${queueItem.operation_type}:${queueItem.entity_id}`);

      // Perform rollback based on operation type
      switch (queueItem.operation_type) {
        case 'create_registration':
          await this.rollbackRegistrationCreation(queueItem.entity_id);
          break;
        case 'upload_photo':
          await this.rollbackPhotoUpload(queueItem.entity_id);
          break;
        case 'update_user':
          // User updates typically don't need rollback
          console.log('User update rollback not required');
          break;
        default:
          console.warn(`No rollback implemented for operation type: ${queueItem.operation_type}`);
      }

      // Remove the failed operation from queue
      await this.markCompleted(queueItemId);
      
      console.log(`✅ Rollback completed for operation: ${queueItemId}`);
    } catch (error) {
      console.error('❌ Rollback failed:', error);
      throw error;
    }
  }

  /**
   * Rollback registration creation
   */
  private async rollbackRegistrationCreation(registrationId: string): Promise<void> {
    // Set registration back to pending status for retry
    await this.storageService.executeQuery(
      `UPDATE weight_registrations 
       SET sync_status = 'pending', 
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), registrationId]
    );
    
    console.log(`🔄 Registration ${registrationId} status reset to pending`);
  }

  /**
   * Rollback photo upload
   */
  private async rollbackPhotoUpload(registrationId: string): Promise<void> {
    // Reset photo-related fields and sync status
    await this.storageService.executeQuery(
      `UPDATE weight_registrations 
       SET photo_url = NULL, 
           ocr_confidence = NULL,
           sync_status = 'pending',
           updated_at = ?
       WHERE id = ?`,
      [new Date().toISOString(), registrationId]
    );
    
    console.log(`🔄 Photo upload rolled back for registration: ${registrationId}`);
  }

  /**
   * Get queue item by ID
   */
  private async getQueueItemById(queueItemId: string): Promise<SyncQueueItem | null> {
    try {
      const results = await this.storageService.executeQuery(
        'SELECT * FROM sync_queue WHERE id = ?',
        [queueItemId]
      );
      
      if (results.length === 0) {
        return null;
      }
      
      return this.mapDatabaseRowToQueueItem(results[0]);
    } catch (error) {
      console.error('❌ Failed to get queue item:', error);
      return null;
    }
  }

  /**
   * Validate data integrity during sync
   */
  public async validateDataIntegrity(registrationId: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      // Get local registration
      const localRegistration = await this.getLocalRegistration(registrationId);
      if (!localRegistration) {
        errors.push('Local registration not found');
        return { isValid: false, errors };
      }

      // Validate required fields
      if (!localRegistration.weight || localRegistration.weight <= 0) {
        errors.push('Invalid weight value');
      }

      if (!localRegistration.cut_type || !['jamón', 'chuleta'].includes(localRegistration.cut_type)) {
        errors.push('Invalid cut type');
      }

      if (!localRegistration.supplier || localRegistration.supplier.trim() === '') {
        errors.push('Supplier is required');
      }

      if (!localRegistration.registered_by || localRegistration.registered_by.trim() === '') {
        errors.push('Registered by is required');
      }

      // Validate OCR confidence if present
      if (localRegistration.ocr_confidence !== null && 
          (localRegistration.ocr_confidence < 0 || localRegistration.ocr_confidence > 1)) {
        errors.push('OCR confidence must be between 0 and 1');
      }

      // Validate dates
      try {
        new Date(localRegistration.created_at);
        new Date(localRegistration.updated_at);
      } catch {
        errors.push('Invalid date format');
      }

    } catch (error) {
      errors.push(`Validation error: ${error}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get sync queue statistics
   */
  public async getQueueStats(): Promise<{
    totalPending: number;
    byType: Record<OperationType, number>;
    highPriority: number;
    failedOperations: number;
  }> {
    try {
      const [total, registrations, photos, users, failed] = await Promise.all([
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM sync_queue WHERE retry_count < ?', [this.MAX_RETRIES]),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM sync_queue WHERE operation_type = ? AND retry_count < ?', ['create_registration', this.MAX_RETRIES]),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM sync_queue WHERE operation_type = ? AND retry_count < ?', ['upload_photo', this.MAX_RETRIES]),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM sync_queue WHERE operation_type = ? AND retry_count < ?', ['update_user', this.MAX_RETRIES]),
        this.storageService.executeQuery('SELECT COUNT(*) as count FROM sync_queue WHERE retry_count >= ?', [this.MAX_RETRIES]),
      ]);

      return {
        totalPending: total[0]?.count || 0,
        byType: {
          create_registration: registrations[0]?.count || 0,
          upload_photo: photos[0]?.count || 0,
          update_user: users[0]?.count || 0,
        },
        highPriority: registrations[0]?.count || 0,
        failedOperations: failed[0]?.count || 0,
      };
    } catch (error) {
      console.error('❌ Failed to get queue stats:', error);
      throw error;
    }
  }

  /**
   * Get detailed sync errors for error logging and display
   */
  public async getSyncErrors(): Promise<Array<{
    id: string;
    operation_type: OperationType;
    entity_id: string;
    error_message?: string;
    error_category: 'network' | 'validation' | 'server' | 'unknown';
    retry_count: number;
    max_retries: number;
    last_attempt_at?: string;
    created_at: string;
    can_retry: boolean;
  }>> {
    try {
      const results = await this.storageService.executeQuery(
        `SELECT * FROM sync_queue 
         WHERE retry_count > 0 
         ORDER BY last_attempt_at DESC, created_at DESC 
         LIMIT 50`
      );

      return results.map(row => {
        const queueItem = this.mapDatabaseRowToQueueItem(row);
        
        // Categorize error based on error message
        let errorCategory: 'network' | 'validation' | 'server' | 'unknown' = 'unknown';
        if (queueItem.error_message) {
          const errorMsg = queueItem.error_message.toLowerCase();
          if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('timeout')) {
            errorCategory = 'network';
          } else if (errorMsg.includes('validation') || errorMsg.includes('invalid') || errorMsg.includes('required')) {
            errorCategory = 'validation';
          } else if (errorMsg.includes('server') || errorMsg.includes('internal') || errorMsg.includes('500')) {
            errorCategory = 'server';
          }
        }

        return {
          id: queueItem.id,
          operation_type: queueItem.operation_type,
          entity_id: queueItem.entity_id,
          error_message: queueItem.error_message,
          error_category: errorCategory,
          retry_count: queueItem.retry_count,
          max_retries: this.MAX_RETRIES,
          last_attempt_at: queueItem.last_attempt_at,
          created_at: queueItem.created_at,
          can_retry: queueItem.retry_count < this.MAX_RETRIES && errorCategory !== 'validation',
        };
      });
    } catch (error) {
      console.error('❌ Failed to get sync errors:', error);
      throw error;
    }
  }

  /**
   * Retry a specific failed operation by ID
   */
  public async retryFailedOperation(queueItemId: string): Promise<void> {
    try {
      const queueItem = await this.getQueueItemById(queueItemId);
      if (!queueItem) {
        throw new Error(`Queue item not found: ${queueItemId}`);
      }

      if (queueItem.retry_count >= this.MAX_RETRIES) {
        throw new Error(`Maximum retries reached for operation: ${queueItemId}`);
      }

      console.log(`🔄 Retrying individual operation: ${queueItem.operation_type}:${queueItem.entity_id}`);
      
      // Process the individual operation
      await this.processOperation(queueItem);
      await this.markCompleted(queueItem.id);
      
      console.log(`✅ Individual retry successful: ${queueItemId}`);
    } catch (error) {
      console.error(`❌ Individual retry failed: ${queueItemId}`, error);
      await this.markFailed(queueItemId, String(error));
      throw error;
    }
  }

  /**
   * Clear a specific error from the queue
   */
  public async clearError(queueItemId: string): Promise<void> {
    try {
      await this.storageService.executeQuery(
        'DELETE FROM sync_queue WHERE id = ?',
        [queueItemId]
      );
      console.log(`✅ Error cleared from queue: ${queueItemId}`);
    } catch (error) {
      console.error('❌ Failed to clear error:', error);
      throw error;
    }
  }

  /**
   * Enhanced error marking with better categorization
   */
  public async markFailedWithCategory(
    queueItemId: string,
    errorMessage: string,
    errorCategory?: 'network' | 'validation' | 'server' | 'unknown'
  ): Promise<void> {
    try {
      const now = new Date().toISOString();
      
      // Auto-categorize if not provided
      let category = errorCategory || 'unknown';
      if (!errorCategory) {
        const errorMsg = errorMessage.toLowerCase();
        if (errorMsg.includes('network') || errorMsg.includes('connection') || errorMsg.includes('timeout')) {
          category = 'network';
        } else if (errorMsg.includes('validation') || errorMsg.includes('invalid') || errorMsg.includes('required')) {
          category = 'validation';
        } else if (errorMsg.includes('server') || errorMsg.includes('internal') || errorMsg.includes('500')) {
          category = 'server';
        }
      }

      // Enhanced error message with category
      const enhancedErrorMessage = `[${category.toUpperCase()}] ${errorMessage}`;
      
      await this.storageService.executeQuery(
        `UPDATE sync_queue 
         SET retry_count = retry_count + 1, 
             last_attempt_at = ?, 
             error_message = ?
         WHERE id = ?`,
        [now, enhancedErrorMessage, queueItemId]
      );
      
      console.log(`⚠️ Sync operation failed with category [${category}]: ${queueItemId} - ${errorMessage}`);
    } catch (error) {
      console.error('❌ Failed to mark operation as failed with category:', error);
      throw error;
    }
  }

  /**
   * Clear failed operations from queue
   */
  public async clearFailedOperations(): Promise<number> {
    try {
      const result = await this.storageService.executeQuery(
        'DELETE FROM sync_queue WHERE retry_count >= ?',
        [this.MAX_RETRIES]
      );
      
      console.log(`✅ Cleared ${result.length} failed operations from queue`);
      return result.length;
    } catch (error) {
      console.error('❌ Failed to clear failed operations:', error);
      throw error;
    }
  }

  /**
   * Get retry delay for operation
   */
  private getRetryDelay(retryCount: number): number {
    if (retryCount >= this.RETRY_DELAYS.length) {
      return this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1];
    }
    return this.RETRY_DELAYS[retryCount];
  }

  /**
   * Check if queue processing is in progress
   */
  public isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  /**
   * Map database row to queue item object
   */
  private mapDatabaseRowToQueueItem(row: any): SyncQueueItem {
    return {
      id: row.id,
      operation_type: row.operation_type,
      entity_id: row.entity_id,
      payload: row.payload,
      priority: row.priority,
      retry_count: row.retry_count,
      last_attempt_at: row.last_attempt_at || undefined,
      error_message: row.error_message || undefined,
      created_at: row.created_at,
    };
  }
}

export default SyncQueueService;