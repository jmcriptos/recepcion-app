/**
 * Conflict Resolution Utilities
 * Handles data conflicts between local and server data
 */

import { LocalWeightRegistration, LocalUser } from '../types/offline';

export type ConflictResolutionStrategy = 'local_wins' | 'server_wins' | 'merge' | 'manual';

export interface DataConflict<T> {
  id: string;
  localData: T;
  serverData: T;
  conflictFields: string[];
  timestamp: string;
}

export interface ConflictResolution<T> {
  strategy: ConflictResolutionStrategy;
  resolvedData: T;
  appliedChanges: string[];
}

class ConflictResolutionService {
  private static instance: ConflictResolutionService;

  public static getInstance(): ConflictResolutionService {
    if (!ConflictResolutionService.instance) {
      ConflictResolutionService.instance = new ConflictResolutionService();
    }
    return ConflictResolutionService.instance;
  }

  /**
   * Detect conflicts between local and server registration data
   */
  public detectRegistrationConflicts(
    localData: LocalWeightRegistration,
    serverData: LocalWeightRegistration
  ): DataConflict<LocalWeightRegistration> | null {
    const conflictFields: string[] = [];

    // Check for differences in key fields
    if (localData.weight !== serverData.weight) {
      conflictFields.push('weight');
    }

    if (localData.cut_type !== serverData.cut_type) {
      conflictFields.push('cut_type');
    }

    if (localData.supplier !== serverData.supplier) {
      conflictFields.push('supplier');
    }

    if (localData.photo_url !== serverData.photo_url) {
      conflictFields.push('photo_url');
    }

    if (localData.ocr_confidence !== serverData.ocr_confidence) {
      conflictFields.push('ocr_confidence');
    }

    // Only consider it a conflict if there are meaningful differences
    if (conflictFields.length === 0) {
      return null;
    }

    return {
      id: localData.id,
      localData,
      serverData,
      conflictFields,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detect conflicts between local and server user data
   */
  public detectUserConflicts(
    localData: LocalUser,
    serverData: LocalUser
  ): DataConflict<LocalUser> | null {
    const conflictFields: string[] = [];

    if (localData.name !== serverData.name) {
      conflictFields.push('name');
    }

    if (localData.role !== serverData.role) {
      conflictFields.push('role');
    }

    if (localData.active !== serverData.active) {
      conflictFields.push('active');
    }

    if (localData.last_login !== serverData.last_login) {
      conflictFields.push('last_login');
    }

    if (conflictFields.length === 0) {
      return null;
    }

    return {
      id: localData.id,
      localData,
      serverData,
      conflictFields,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Resolve registration conflict using specified strategy
   */
  public resolveRegistrationConflict(
    conflict: DataConflict<LocalWeightRegistration>,
    strategy: ConflictResolutionStrategy = 'server_wins'
  ): ConflictResolution<LocalWeightRegistration> {
    const appliedChanges: string[] = [];
    let resolvedData: LocalWeightRegistration;

    switch (strategy) {
      case 'local_wins':
        resolvedData = { ...conflict.localData };
        appliedChanges.push('Applied all local changes');
        break;

      case 'server_wins':
        resolvedData = { ...conflict.serverData };
        appliedChanges.push('Applied all server changes');
        break;

      case 'merge':
        resolvedData = this.mergeRegistrationData(conflict);
        appliedChanges.push('Merged local and server data');
        break;

      default:
        // Default to server wins for safety
        resolvedData = { ...conflict.serverData };
        appliedChanges.push('Default resolution: server wins');
        break;
    }

    console.log(`✅ Resolved registration conflict for ${conflict.id} using ${strategy}`);
    
    return {
      strategy,
      resolvedData,
      appliedChanges,
    };
  }

  /**
   * Resolve user conflict using specified strategy
   */
  public resolveUserConflict(
    conflict: DataConflict<LocalUser>,
    strategy: ConflictResolutionStrategy = 'server_wins'
  ): ConflictResolution<LocalUser> {
    const appliedChanges: string[] = [];
    let resolvedData: LocalUser;

    switch (strategy) {
      case 'local_wins':
        resolvedData = { ...conflict.localData };
        appliedChanges.push('Applied all local changes');
        break;

      case 'server_wins':
        resolvedData = { ...conflict.serverData };
        appliedChanges.push('Applied all server changes');
        break;

      case 'merge':
        resolvedData = this.mergeUserData(conflict);
        appliedChanges.push('Merged local and server data');
        break;

      default:
        resolvedData = { ...conflict.serverData };
        appliedChanges.push('Default resolution: server wins');
        break;
    }

    console.log(`✅ Resolved user conflict for ${conflict.id} using ${strategy}`);
    
    return {
      strategy,
      resolvedData,
      appliedChanges,
    };
  }

  /**
   * Smart merge strategy for registration data
   */
  private mergeRegistrationData(
    conflict: DataConflict<LocalWeightRegistration>
  ): LocalWeightRegistration {
    const { localData, serverData } = conflict;
    const merged = { ...serverData }; // Start with server data as base

    // Business logic for merging specific fields
    
    // For weight: prefer the more recent measurement (based on updated_at)
    if (new Date(localData.updated_at) > new Date(serverData.updated_at)) {
      merged.weight = localData.weight;
      merged.updated_at = localData.updated_at;
    }

    // For OCR confidence: prefer higher confidence
    if (localData.ocr_confidence && serverData.ocr_confidence) {
      if (localData.ocr_confidence > serverData.ocr_confidence) {
        merged.ocr_confidence = localData.ocr_confidence;
      }
    } else if (localData.ocr_confidence && !serverData.ocr_confidence) {
      merged.ocr_confidence = localData.ocr_confidence;
    }

    // For photo: prefer server photo URL if available
    if (serverData.photo_url) {
      merged.photo_url = serverData.photo_url;
    } else if (localData.local_photo_path) {
      merged.local_photo_path = localData.local_photo_path;
    }

    // For critical business fields, server always wins
    // (cut_type, supplier, registered_by)
    merged.cut_type = serverData.cut_type;
    merged.supplier = serverData.supplier;
    merged.registered_by = serverData.registered_by;

    return merged;
  }

  /**
   * Smart merge strategy for user data
   */
  private mergeUserData(conflict: DataConflict<LocalUser>): LocalUser {
    const { localData, serverData } = conflict;
    const merged = { ...serverData }; // Start with server data as base

    // For last_login: prefer the more recent timestamp
    if (localData.last_login && serverData.last_login) {
      if (new Date(localData.last_login) > new Date(serverData.last_login)) {
        merged.last_login = localData.last_login;
      }
    } else if (localData.last_login && !serverData.last_login) {
      merged.last_login = localData.last_login;
    }

    // For critical fields, server always wins
    merged.name = serverData.name;
    merged.role = serverData.role;
    merged.active = serverData.active;
    merged.created_at = serverData.created_at;

    return merged;
  }

  /**
   * Get recommended resolution strategy based on conflict type
   */
  public getRecommendedStrategy<T>(
    conflict: DataConflict<T>
  ): ConflictResolutionStrategy {
    // For critical business data fields, server should win
    const criticalFields = ['cut_type', 'supplier', 'registered_by', 'role', 'active'];
    const hasCriticalConflict = conflict.conflictFields.some(field => 
      criticalFields.includes(field)
    );

    if (hasCriticalConflict) {
      return 'server_wins';
    }

    // For metadata fields, try to merge intelligently
    const metadataFields = ['ocr_confidence', 'last_login', 'photo_url'];
    const isOnlyMetadata = conflict.conflictFields.every(field => 
      metadataFields.includes(field)
    );

    if (isOnlyMetadata) {
      return 'merge';
    }

    // Default to server wins for safety
    return 'server_wins';
  }

  /**
   * Validate conflict resolution
   */
  public validateResolution<T>(
    original: DataConflict<T>,
    resolution: ConflictResolution<T>
  ): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Basic validation
    if (!resolution.resolvedData) {
      errors.push('Resolved data is required');
    }

    if (!resolution.strategy) {
      errors.push('Resolution strategy is required');
    }

    // Type-specific validation
    if ('weight' in (original.localData as object) && 'weight' in (resolution.resolvedData as object)) {
      const resolvedWeight = (resolution.resolvedData as any).weight;
      if (typeof resolvedWeight !== 'number' || resolvedWeight <= 0) {
        errors.push('Resolved weight must be a positive number');
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Log conflict resolution for audit purposes
   */
  public logConflictResolution<T>(
    conflict: DataConflict<T>,
    resolution: ConflictResolution<T>
  ): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      entityId: conflict.id,
      conflictFields: conflict.conflictFields,
      strategy: resolution.strategy,
      appliedChanges: resolution.appliedChanges,
    };

    console.log('🔄 Conflict Resolution Log:', JSON.stringify(logEntry, null, 2));
    
    // In a real implementation, this could be stored in a conflict resolution log table
  }

  /**
   * Get conflict statistics
   */
  public getConflictStats(conflicts: DataConflict<any>[]): {
    totalConflicts: number;
    byField: Record<string, number>;
    mostCommonField: string;
  } {
    const fieldCounts: Record<string, number> = {};
    
    conflicts.forEach(conflict => {
      conflict.conflictFields.forEach(field => {
        fieldCounts[field] = (fieldCounts[field] || 0) + 1;
      });
    });

    const mostCommonField = Object.keys(fieldCounts).reduce((a, b) => 
      fieldCounts[a] > fieldCounts[b] ? a : b, ''
    );

    return {
      totalConflicts: conflicts.length,
      byField: fieldCounts,
      mostCommonField,
    };
  }
}

export default ConflictResolutionService;