/**
 * Session Storage Service
 * Handles secure session persistence using AsyncStorage
 * Manages session timeout and cleanup for industrial work environment
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { User } from '../types/auth';

interface SessionData {
  user: User;
  loginTime: number;
  lastActivity: number;
  expiresAt: number;
}

class SessionStorage {
  private readonly SESSION_KEY = '@meat_reception_session';
  private readonly SESSION_TIMEOUT = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
  
  /**
   * Save session data to secure storage
   */
  async saveSession(user: User): Promise<void> {
    try {
      const now = Date.now();
      const sessionData: SessionData = {
        user,
        loginTime: now,
        lastActivity: now,
        expiresAt: now + this.SESSION_TIMEOUT,
      };

      await AsyncStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error saving session:', error);
      throw new Error('Error al guardar la sesión');
    }
  }

  /**
   * Get current session data if valid
   */
  async getSession(): Promise<SessionData | null> {
    try {
      const sessionJson = await AsyncStorage.getItem(this.SESSION_KEY);
      
      if (!sessionJson) {
        return null;
      }

      const sessionData: SessionData = JSON.parse(sessionJson);
      const now = Date.now();

      // Check if session has expired
      if (now > sessionData.expiresAt) {
        await this.clearSession();
        return null;
      }

      return sessionData;
    } catch (error) {
      console.error('Error retrieving session:', error);
      await this.clearSession(); // Clean up corrupted session data
      return null;
    }
  }

  /**
   * Update last activity timestamp
   */
  async updateLastActivity(): Promise<void> {
    try {
      const sessionData = await this.getSession();
      
      if (!sessionData) {
        return;
      }

      sessionData.lastActivity = Date.now();
      await AsyncStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error updating last activity:', error);
    }
  }

  /**
   * Check if session is still valid
   */
  async isSessionValid(): Promise<boolean> {
    try {
      const sessionData = await this.getSession();
      return sessionData !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current user if session is valid
   */
  async getCurrentUser(): Promise<User | null> {
    try {
      const sessionData = await this.getSession();
      return sessionData?.user || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Check if session will expire soon (within 15 minutes)
   */
  async isSessionExpiringSoon(): Promise<boolean> {
    try {
      const sessionData = await this.getSession();
      
      if (!sessionData) {
        return false;
      }

      const now = Date.now();
      const fifteenMinutes = 15 * 60 * 1000;
      
      return (sessionData.expiresAt - now) <= fifteenMinutes;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get remaining session time in milliseconds
   */
  async getRemainingSessionTime(): Promise<number> {
    try {
      const sessionData = await this.getSession();
      
      if (!sessionData) {
        return 0;
      }

      const now = Date.now();
      return Math.max(0, sessionData.expiresAt - now);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Extend session by updating expiration time
   */
  async extendSession(): Promise<void> {
    try {
      const sessionData = await this.getSession();
      
      if (!sessionData) {
        return;
      }

      const now = Date.now();
      sessionData.lastActivity = now;
      sessionData.expiresAt = now + this.SESSION_TIMEOUT;
      
      await AsyncStorage.setItem(this.SESSION_KEY, JSON.stringify(sessionData));
    } catch (error) {
      console.error('Error extending session:', error);
      throw new Error('Error al extender la sesión');
    }
  }

  /**
   * Clear session data
   */
  async clearSession(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.SESSION_KEY);
    } catch (error) {
      console.error('Error clearing session:', error);
    }
  }

  /**
   * Get session info for debugging/monitoring
   */
  async getSessionInfo(): Promise<{
    hasSession: boolean;
    remainingTime: number;
    isExpiringSoon: boolean;
    loginTime?: number;
    lastActivity?: number;
  }> {
    try {
      const sessionData = await this.getSession();
      
      if (!sessionData) {
        return {
          hasSession: false,
          remainingTime: 0,
          isExpiringSoon: false,
        };
      }

      const remainingTime = await this.getRemainingSessionTime();
      const isExpiringSoon = await this.isSessionExpiringSoon();

      return {
        hasSession: true,
        remainingTime,
        isExpiringSoon,
        loginTime: sessionData.loginTime,
        lastActivity: sessionData.lastActivity,
      };
    } catch (error) {
      return {
        hasSession: false,
        remainingTime: 0,
        isExpiringSoon: false,
      };
    }
  }
}

// Export singleton instance
export const sessionStorage = new SessionStorage();
export default sessionStorage;