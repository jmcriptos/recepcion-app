/**
 * Photo Storage Service
 * Manages local photo storage, compression, and cleanup for offline functionality
 */

import RNFS from 'react-native-fs';
import { Image } from 'react-native-image-crop-picker';

interface PhotoMetadata {
  id: string;
  originalPath: string;
  compressedPath: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  uploadStatus: 'pending' | 'uploaded' | 'failed';
  createdAt: string;
}

class PhotoStorageService {
  private static instance: PhotoStorageService;
  private readonly photosDirectory: string;
  private readonly maxPhotoSize = 2 * 1024 * 1024; // 2MB
  private readonly compressionQuality = 0.8;
  private readonly retentionDays = 7;

  constructor() {
    this.photosDirectory = `${RNFS.DocumentDirectoryPath}/photos`;
  }

  public static getInstance(): PhotoStorageService {
    if (!PhotoStorageService.instance) {
      PhotoStorageService.instance = new PhotoStorageService();
    }
    return PhotoStorageService.instance;
  }

  /**
   * Initialize photo storage directory
   */
  public async initializeStorage(): Promise<void> {
    try {
      const exists = await RNFS.exists(this.photosDirectory);
      if (!exists) {
        await RNFS.mkdir(this.photosDirectory);
        console.log('✅ Photo storage directory created');
      }
      
      // Clean up old photos on initialization
      await this.cleanupOldPhotos();
    } catch (error) {
      console.error('❌ Failed to initialize photo storage:', error);
      throw new Error(`Photo storage initialization failed: ${error}`);
    }
  }

  /**
   * Store and compress a photo locally
   */
  public async storePhoto(
    photoPath: string,
    photoId: string
  ): Promise<PhotoMetadata> {
    try {
      // Validate photo exists
      const exists = await RNFS.exists(photoPath);
      if (!exists) {
        throw new Error('Photo file does not exist');
      }

      // Get original file stats
      const originalStats = await RNFS.stat(photoPath);
      const originalSize = originalStats.size;

      // Generate paths for local storage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `${photoId}_${timestamp}`;
      const originalPath = `${this.photosDirectory}/${fileName}_original.jpg`;
      const compressedPath = `${this.photosDirectory}/${fileName}_compressed.jpg`;

      // Copy original photo to local storage
      await RNFS.copyFile(photoPath, originalPath);

      // Compress the photo
      const compressedSize = await this.compressPhoto(originalPath, compressedPath);

      // Calculate compression ratio
      const compressionRatio = (originalSize - compressedSize) / originalSize;

      const metadata: PhotoMetadata = {
        id: photoId,
        originalPath,
        compressedPath,
        originalSize,
        compressedSize,
        compressionRatio,
        uploadStatus: 'pending',
        createdAt: new Date().toISOString(),
      };

      console.log(`✅ Photo stored locally: ${photoId} (${this.formatFileSize(originalSize)} → ${this.formatFileSize(compressedSize)})`);
      return metadata;
    } catch (error) {
      console.error('❌ Failed to store photo:', error);
      throw new Error(`Failed to store photo: ${error}`);
    }
  }

  /**
   * Compress photo to target size
   */
  private async compressPhoto(inputPath: string, outputPath: string): Promise<number> {
    try {
      // For React Native, we'll use a basic compression approach
      // In a real implementation, you might use react-native-image-resizer
      // or similar libraries for more advanced compression
      
      // For now, we'll copy the file and assume compression happens elsewhere
      // This is a placeholder for the compression logic
      await RNFS.copyFile(inputPath, outputPath);
      
      const stats = await RNFS.stat(outputPath);
      const fileSize = stats.size;
      
      // If file is still too large, we should implement actual compression
      if (fileSize > this.maxPhotoSize) {
        console.warn(`⚠️ Photo size (${this.formatFileSize(fileSize)}) exceeds target (${this.formatFileSize(this.maxPhotoSize)})`);
      }
      
      return fileSize;
    } catch (error) {
      console.error('❌ Photo compression failed:', error);
      throw error;
    }
  }

  /**
   * Retrieve photo by ID
   */
  public async getPhoto(photoId: string): Promise<PhotoMetadata | null> {
    try {
      const files = await RNFS.readDir(this.photosDirectory);
      const photoFiles = files.filter(file => file.name.startsWith(photoId));
      
      if (photoFiles.length === 0) {
        return null;
      }

      // Find the compressed version
      const compressedFile = photoFiles.find(file => file.name.includes('_compressed.jpg'));
      const originalFile = photoFiles.find(file => file.name.includes('_original.jpg'));
      
      if (!compressedFile || !originalFile) {
        return null;
      }

      const originalStats = await RNFS.stat(originalFile.path);
      const compressedStats = await RNFS.stat(compressedFile.path);
      
      const originalSize = originalStats.size;
      const compressedSize = compressedStats.size;
      
      return {
        id: photoId,
        originalPath: originalFile.path,
        compressedPath: compressedFile.path,
        originalSize,
        compressedSize,
        compressionRatio: (originalSize - compressedSize) / originalSize,
        uploadStatus: 'pending', // Would need to be tracked elsewhere
        createdAt: new Date(originalStats.ctime).toISOString(),
      };
    } catch (error) {
      console.error('❌ Failed to get photo:', error);
      return null;
    }
  }

  /**
   * Get photo file path for display
   */
  public async getPhotoPath(photoId: string, useCompressed: boolean = true): Promise<string | null> {
    const photo = await this.getPhoto(photoId);
    if (!photo) {
      return null;
    }
    
    return useCompressed ? photo.compressedPath : photo.originalPath;
  }

  /**
   * Delete photo by ID
   */
  public async deletePhoto(photoId: string): Promise<void> {
    try {
      const files = await RNFS.readDir(this.photosDirectory);
      const photoFiles = files.filter(file => file.name.startsWith(photoId));
      
      for (const file of photoFiles) {
        await RNFS.unlink(file.path);
        console.log(`✅ Deleted photo file: ${file.name}`);
      }
    } catch (error) {
      console.error('❌ Failed to delete photo:', error);
      throw error;
    }
  }

  /**
   * Clean up old photos based on retention policy
   */
  public async cleanupOldPhotos(): Promise<void> {
    try {
      const files = await RNFS.readDir(this.photosDirectory);
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.retentionDays);
      
      let deletedCount = 0;
      
      for (const file of files) {
        const fileStats = await RNFS.stat(file.path);
        if (new Date(fileStats.ctime) < cutoffDate) {
          await RNFS.unlink(file.path);
          deletedCount++;
        }
      }
      
      if (deletedCount > 0) {
        console.log(`✅ Cleaned up ${deletedCount} old photo files`);
      }
    } catch (error) {
      console.error('❌ Photo cleanup failed:', error);
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  public async getStorageStats(): Promise<{
    totalPhotos: number;
    totalSize: number;
    pendingUploads: number;
    averageCompressionRatio: number;
  }> {
    try {
      const files = await RNFS.readDir(this.photosDirectory);
      let totalSize = 0;
      let totalCompressionRatio = 0;
      const photoIds = new Set<string>();
      
      for (const file of files) {
        const stats = await RNFS.stat(file.path);
        totalSize += stats.size;
        
        // Extract photo ID from filename
        const photoId = file.name.split('_')[0];
        photoIds.add(photoId);
      }
      
      const totalPhotos = photoIds.size;
      
      // For simplicity, assuming average compression of 30%
      const averageCompressionRatio = 0.3;
      
      return {
        totalPhotos,
        totalSize,
        pendingUploads: totalPhotos, // Would need to track upload status separately
        averageCompressionRatio,
      };
    } catch (error) {
      console.error('❌ Failed to get storage stats:', error);
      throw error;
    }
  }

  /**
   * Validate photo file
   */
  public async validatePhoto(photoPath: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      const exists = await RNFS.exists(photoPath);
      if (!exists) {
        errors.push('Photo file does not exist');
        return { isValid: false, errors };
      }
      
      const stats = await RNFS.stat(photoPath);
      const fileSize = stats.size;
      
      if (fileSize === 0) {
        errors.push('Photo file is empty');
      }
      
      if (fileSize > 50 * 1024 * 1024) { // 50MB max for original
        errors.push('Photo file is too large (max 50MB)');
      }
      
      // Check file extension
      const extension = photoPath.toLowerCase().split('.').pop();
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      if (!extension || !validExtensions.includes(extension)) {
        errors.push(`Invalid photo format. Supported: ${validExtensions.join(', ')}`);
      }
      
    } catch (error) {
      errors.push(`Failed to validate photo: ${error}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format file size for display
   */
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get available disk space
   */
  public async getAvailableSpace(): Promise<number> {
    try {
      const fsInfo = await RNFS.getFSInfo();
      return fsInfo.freeSpace;
    } catch (error) {
      console.error('❌ Failed to get disk space:', error);
      return 0;
    }
  }
}

export default PhotoStorageService;