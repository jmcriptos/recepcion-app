/**
 * Sync Notification Service
 * Manages sync status notifications and user feedback
 * Provides toast notifications and sync progress indicators
 */

import { SyncProgress } from '../types/offline';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface SyncNotification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  duration?: number;
  timestamp: string;
}

type NotificationCallback = (notification: SyncNotification) => void;

class SyncNotificationService {
  private static instance: SyncNotificationService;
  private notificationCallbacks: NotificationCallback[] = [];
  private notificationHistory: SyncNotification[] = [];
  private readonly maxHistorySize = 50;

  public static getInstance(): SyncNotificationService {
    if (!SyncNotificationService.instance) {
      SyncNotificationService.instance = new SyncNotificationService();
    }
    return SyncNotificationService.instance;
  }

  /**
   * Add notification callback listener
   */
  public addNotificationListener(callback: NotificationCallback): () => void {
    this.notificationCallbacks.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.notificationCallbacks.indexOf(callback);
      if (index > -1) {
        this.notificationCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Show sync completion notification
   */
  public notifySyncCompleted(progress: SyncProgress): void {
    const { completed, failed, total } = progress;
    
    if (failed === 0 && completed > 0) {
      // All successful
      this.showNotification({
        type: 'success',
        title: '✅ Sincronización Completada',
        message: `Se sincronizaron ${completed} registros exitosamente`,
        duration: 4000,
      });
    } else if (failed > 0 && completed > 0) {
      // Mixed results
      this.showNotification({
        type: 'warning',
        title: '⚠️ Sincronización Parcial',
        message: `${completed} exitosos, ${failed} fallaron. Revisar detalles.`,
        duration: 6000,
      });
    } else if (failed > 0 && completed === 0) {
      // All failed
      this.showNotification({
        type: 'error',
        title: '❌ Sincronización Fallida',
        message: `${failed} registros no se pudieron sincronizar`,
        duration: 8000,
      });
    } else if (total === 0) {
      // No items to sync
      this.showNotification({
        type: 'info',
        title: 'ℹ️ Sin Cambios',
        message: 'No hay registros pendientes de sincronización',
        duration: 3000,
      });
    }
  }

  /**
   * Show sync start notification
   */
  public notifySyncStarted(totalItems: number): void {
    this.showNotification({
      type: 'info',
      title: '🔄 Sincronizando...',
      message: `Iniciando sincronización de ${totalItems} registros`,
      duration: 3000,
    });
  }

  /**
   * Show connectivity restored notification
   */
  public notifyConnectivityRestored(): void {
    this.showNotification({
      type: 'success',
      title: '🌐 Conexión Restaurada',
      message: 'Conexión a internet restaurada. Sincronizando automáticamente...',
      duration: 4000,
    });
  }

  /**
   * Show connectivity lost notification
   */
  public notifyConnectivityLost(): void {
    this.showNotification({
      type: 'warning',
      title: '📴 Sin Conexión',
      message: 'Conexión perdida. Los registros se guardarán localmente.',
      duration: 5000,
    });
  }

  /**
   * Show sync error notification
   */
  public notifySyncError(error: string): void {
    this.showNotification({
      type: 'error',
      title: '❌ Error de Sincronización',
      message: `Error: ${error}`,
      duration: 8000,
    });
  }

  /**
   * Show conflict resolution notification
   */
  public notifyConflictResolved(registrationId: string, strategy: string): void {
    this.showNotification({
      type: 'info',
      title: '🔄 Conflicto Resuelto',
      message: `Registro ${registrationId} resuelto usando: ${strategy}`,
      duration: 5000,
    });
  }

  /**
   * Show session expired notification
   */
  public notifySessionExpired(): void {
    this.showNotification({
      type: 'error',
      title: '🔐 Sesión Expirada',
      message: 'Por favor, inicia sesión nuevamente para continuar.',
      duration: 10000,
    });
  }

  /**
   * Show background sync notification
   */
  public notifyBackgroundSyncCompleted(completed: number, failed: number): void {
    if (completed > 0) {
      this.showNotification({
        type: 'success',
        title: '🔄 Sincronización Automática',
        message: `${completed} registros sincronizados en segundo plano`,
        duration: 4000,
      });
    }
    
    if (failed > 0) {
      this.showNotification({
        type: 'warning',
        title: '⚠️ Sincronización Parcial',
        message: `${failed} registros requieren atención manual`,
        duration: 6000,
      });
    }
  }

  /**
   * Show photo upload progress notification
   */
  public notifyPhotoUploadProgress(registrationId: string, progress: 'started' | 'completed' | 'failed'): void {
    switch (progress) {
      case 'started':
        this.showNotification({
          type: 'info',
          title: '📷 Subiendo Foto',
          message: `Procesando imagen para registro ${registrationId}`,
          duration: 3000,
        });
        break;
      case 'completed':
        this.showNotification({
          type: 'success',
          title: '✅ Foto Procesada',
          message: `Imagen subida y procesada exitosamente`,
          duration: 4000,
        });
        break;
      case 'failed':
        this.showNotification({
          type: 'error',
          title: '❌ Error en Foto',
          message: `No se pudo procesar la imagen`,
          duration: 6000,
        });
        break;
    }
  }

  /**
   * Show sync retry notification
   */
  public notifySyncRetry(registrationId: string, attempt: number, maxAttempts: number): void {
    this.showNotification({
      type: 'info',
      title: '🔄 Reintentando',
      message: `Reintento ${attempt}/${maxAttempts} para registro ${registrationId}`,
      duration: 3000,
    });
  }

  /**
   * Show offline mode notification
   */
  public notifyOfflineMode(enabled: boolean): void {
    if (enabled) {
      this.showNotification({
        type: 'info',
        title: '📴 Modo Offline',
        message: 'Trabajando sin conexión. Los datos se sincronizarán automáticamente.',
        duration: 5000,
      });
    } else {
      this.showNotification({
        type: 'success',
        title: '🌐 Modo Online',
        message: 'Conexión restaurada. Sincronizando datos...',
        duration: 4000,
      });
    }
  }

  /**
   * Show custom notification
   */
  public showNotification(options: {
    type: NotificationType;
    title: string;
    message: string;
    duration?: number;
  }): void {
    const notification: SyncNotification = {
      id: this.generateNotificationId(),
      type: options.type,
      title: options.title,
      message: options.message,
      duration: options.duration || 5000,
      timestamp: new Date().toISOString(),
    };

    // Add to history
    this.addToHistory(notification);

    // Notify all listeners
    this.notificationCallbacks.forEach(callback => {
      try {
        callback(notification);
      } catch (error) {
        console.error('❌ Error in notification callback:', error);
      }
    });

    console.log(`📢 ${notification.type.toUpperCase()}: ${notification.title} - ${notification.message}`);
  }

  /**
   * Get notification history
   */
  public getNotificationHistory(): SyncNotification[] {
    return [...this.notificationHistory];
  }

  /**
   * Clear notification history
   */
  public clearNotificationHistory(): void {
    this.notificationHistory = [];
  }

  /**
   * Get notifications by type
   */
  public getNotificationsByType(type: NotificationType): SyncNotification[] {
    return this.notificationHistory.filter(notification => notification.type === type);
  }

  /**
   * Get recent notifications (last N)
   */
  public getRecentNotifications(count: number = 10): SyncNotification[] {
    return this.notificationHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, count);
  }

  /**
   * Format sync progress for display
   */
  public formatSyncProgress(progress: SyncProgress): string {
    const { total, completed, failed, currentOperation } = progress;
    
    if (currentOperation) {
      return `Procesando: ${currentOperation} (${completed}/${total})`;
    }
    
    if (total === 0) {
      return 'No hay elementos para sincronizar';
    }
    
    const percentage = Math.round((completed + failed) / total * 100);
    return `Sincronización: ${percentage}% (${completed + failed}/${total})`;
  }

  /**
   * Get sync status summary
   */
  public getSyncStatusSummary(progress: SyncProgress | null): {
    status: 'idle' | 'syncing' | 'completed' | 'failed';
    message: string;
    percentage: number;
  } {
    if (!progress) {
      return {
        status: 'idle',
        message: 'Listo para sincronizar',
        percentage: 0,
      };
    }

    const { total, completed, failed } = progress;
    
    if (total === 0) {
      return {
        status: 'completed',
        message: 'Todo sincronizado',
        percentage: 100,
      };
    }

    const totalProcessed = completed + failed;
    const percentage = Math.round(totalProcessed / total * 100);

    if (totalProcessed < total) {
      return {
        status: 'syncing',
        message: this.formatSyncProgress(progress),
        percentage,
      };
    }

    if (failed === 0) {
      return {
        status: 'completed',
        message: 'Sincronización completada',
        percentage: 100,
      };
    }

    return {
      status: 'failed',
      message: `${completed} exitosos, ${failed} fallidos`,
      percentage: 100,
    };
  }

  /**
   * Add notification to history
   */
  private addToHistory(notification: SyncNotification): void {
    this.notificationHistory.unshift(notification);
    
    // Keep only recent notifications
    if (this.notificationHistory.length > this.maxHistorySize) {
      this.notificationHistory = this.notificationHistory.slice(0, this.maxHistorySize);
    }
  }

  /**
   * Generate unique notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Cleanup resources
   */
  public cleanup(): void {
    this.notificationCallbacks = [];
    this.notificationHistory = [];
    console.log('✅ Sync notification service cleanup completed');
  }
}

export default SyncNotificationService;