/**
 * Data Encryption Utilities
 * Simple encryption for sensitive local data storage
 */

import CryptoJS from 'crypto-js';
import { getUniqueId } from 'react-native-device-info';

class EncryptionService {
  private static instance: EncryptionService;
  private encryptionKey: string | null = null;

  public static getInstance(): EncryptionService {
    if (!EncryptionService.instance) {
      EncryptionService.instance = new EncryptionService();
    }
    return EncryptionService.instance;
  }

  /**
   * Initialize encryption key based on device unique ID
   */
  public async initializeKey(): Promise<void> {
    try {
      const deviceId = await getUniqueId();
      // Create a deterministic key based on device ID
      this.encryptionKey = CryptoJS.SHA256(deviceId + 'meat-reception-salt').toString();
      console.log('✅ Encryption key initialized');
    } catch (error) {
      console.error('❌ Failed to initialize encryption key:', error);
      // Fallback to a static key (less secure but ensures functionality)
      this.encryptionKey = CryptoJS.SHA256('fallback-key-meat-reception').toString();
    }
  }

  /**
   * Encrypt sensitive text data
   */
  public encrypt(text: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!text || text.trim().length === 0) {
      return text;
    }

    try {
      const encrypted = CryptoJS.AES.encrypt(text, this.encryptionKey).toString();
      return encrypted;
    } catch (error) {
      console.error('❌ Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt sensitive text data
   */
  public decrypt(encryptedText: string): string {
    if (!this.encryptionKey) {
      throw new Error('Encryption key not initialized');
    }

    if (!encryptedText || encryptedText.trim().length === 0) {
      return encryptedText;
    }

    try {
      const bytes = CryptoJS.AES.decrypt(encryptedText, this.encryptionKey);
      const decrypted = bytes.toString(CryptoJS.enc.Utf8);
      
      if (!decrypted) {
        throw new Error('Decryption returned empty string');
      }
      
      return decrypted;
    } catch (error) {
      console.error('❌ Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Hash password or sensitive data (one-way)
   */
  public hash(data: string): string {
    return CryptoJS.SHA256(data).toString();
  }

  /**
   * Generate secure random token
   */
  public generateToken(length: number = 32): string {
    return CryptoJS.lib.WordArray.random(length).toString();
  }

  /**
   * Encrypt user session token
   */
  public encryptSessionToken(token: string): string {
    return this.encrypt(token);
  }

  /**
   * Decrypt user session token
   */
  public decryptSessionToken(encryptedToken: string): string {
    return this.decrypt(encryptedToken);
  }

  /**
   * Check if string appears to be encrypted
   */
  public isEncrypted(text: string): boolean {
    if (!text || text.length < 16) {
      return false;
    }
    
    // Basic check for Base64-like encrypted string
    return /^[A-Za-z0-9+/]+=*$/.test(text) && text.length > 20;
  }
}

export default EncryptionService;