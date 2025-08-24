/**
 * Session Manager
 * Handles app state changes, automatic session timeout, and session lifecycle
 * Optimized for industrial work environment with 4-hour work shifts
 */

import { AppState, AppStateStatus } from 'react-native';
import { sessionStorage } from './session-storage';
import { User } from '../types/auth';

interface SessionManagerOptions {
  onSessionExpired: () => void;
  onSessionWarning: (remainingTime: number) => void;
  onSessionExtended: () => void;
}

class SessionManager {
  private appStateSubscription: any;
  private sessionCheckInterval: any = null;
  private backgroundTime: number | null = null;
  private options: SessionManagerOptions | null = null;
  
  // Session check every 30 seconds
  private readonly CHECK_INTERVAL = 30 * 1000;
  
  // Maximum time allowed in background before logout (15 minutes)
  private readonly MAX_BACKGROUND_TIME = 15 * 60 * 1000;

  /**
   * Check if session manager is initialized
   */
  get isInitialized(): boolean {
    return this.options !== null;
  }

  /**
   * Initialize session manager with callback options
   */
  initialize(options: SessionManagerOptions): void {
    this.options = options;
    this.startAppStateListener();
    this.startSessionMonitoring();
  }

  /**
   * Start monitoring app state changes
   */
  private startAppStateListener(): void {
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange.bind(this)
    );
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange = async (nextAppState: AppStateStatus): Promise<void> => {
    if (nextAppState === 'background' || nextAppState === 'inactive') {
      // App going to background
      this.backgroundTime = Date.now();
      await this.handleAppBackground();
    } else if (nextAppState === 'active') {
      // App coming to foreground
      await this.handleAppForeground();
      this.backgroundTime = null;
    }
  };

  /**
   * Handle app going to background
   */
  private async handleAppBackground(): Promise<void> {
    try {
      // Update last activity timestamp
      await sessionStorage.updateLastActivity();
      
      // Stop session monitoring while in background
      this.stopSessionMonitoring();
    } catch (error) {
      console.error('Error handling app background:', error);
    }
  }

  /**
   * Handle app coming to foreground
   */
  private async handleAppForeground(): Promise<void> {
    try {
      // Check if app was in background too long
      if (this.backgroundTime) {
        const backgroundDuration = Date.now() - this.backgroundTime;
        
        if (backgroundDuration > this.MAX_BACKGROUND_TIME) {
          // App was in background too long, expire session
          await sessionStorage.clearSession();
          this.options?.onSessionExpired();
          return;
        }
      }

      // Check if session is still valid
      const isValid = await sessionStorage.isSessionValid();
      if (!isValid) {
        this.options?.onSessionExpired();
        return;
      }

      // Update last activity
      await sessionStorage.updateLastActivity();
      
      // Resume session monitoring
      this.startSessionMonitoring();
    } catch (error) {
      console.error('Error handling app foreground:', error);
      this.options?.onSessionExpired();
    }
  }

  /**
   * Start periodic session monitoring
   */
  private startSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      this.stopSessionMonitoring();
    }

    this.sessionCheckInterval = setInterval(async () => {
      await this.checkSession();
    }, this.CHECK_INTERVAL);
  }

  /**
   * Stop session monitoring
   */
  private stopSessionMonitoring(): void {
    if (this.sessionCheckInterval) {
      clearInterval(this.sessionCheckInterval);
      this.sessionCheckInterval = null;
    }
  }

  /**
   * Check current session status
   */
  private async checkSession(): Promise<void> {
    try {
      const isValid = await sessionStorage.isSessionValid();
      
      if (!isValid) {
        this.options?.onSessionExpired();
        return;
      }

      // Check if session is expiring soon
      const isExpiringSoon = await sessionStorage.isSessionExpiringSoon();
      if (isExpiringSoon) {
        const remainingTime = await sessionStorage.getRemainingSessionTime();
        this.options?.onSessionWarning(remainingTime);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      this.options?.onSessionExpired();
    }
  }

  /**
   * Extend current session
   */
  async extendSession(): Promise<void> {
    try {
      await sessionStorage.extendSession();
      this.options?.onSessionExtended();
    } catch (error) {
      console.error('Error extending session:', error);
      throw error;
    }
  }

  /**
   * Manually update activity timestamp
   */
  async updateActivity(): Promise<void> {
    try {
      await sessionStorage.updateLastActivity();
    } catch (error) {
      console.error('Error updating activity:', error);
    }
  }

  /**
   * Get current session user
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      return await sessionStorage.getCurrentUser();
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if session is valid
   */
  async isSessionValid(): Promise<boolean> {
    try {
      return await sessionStorage.isSessionValid();
    } catch (error) {
      return false;
    }
  }

  /**
   * Logout and clear session
   */
  async logout(): Promise<void> {
    try {
      await sessionStorage.clearSession();
      this.stopSessionMonitoring();
    } catch (error) {
      console.error('Error during logout:', error);
    }
  }

  /**
   * Get detailed session information
   */
  async getSessionInfo(): Promise<any> {
    try {
      return await sessionStorage.getSessionInfo();
    } catch (error) {
      return {
        hasSession: false,
        remainingTime: 0,
        isExpiringSoon: false,
      };
    }
  }

  /**
   * Cleanup and stop all monitoring
   */
  cleanup(): void {
    this.stopSessionMonitoring();
    
    if (this.appStateSubscription) {
      this.appStateSubscription?.remove?.();
      this.appStateSubscription = null;
    }
  }
}

// Export singleton instance
export const sessionManager = new SessionManager();
export default sessionManager;