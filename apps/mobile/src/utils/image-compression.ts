/**
 * Image Compression Utilities
 * Handles photo compression for optimal storage and upload
 */

import ImageResizer from 'react-native-image-resizer';
import RNFS from 'react-native-fs';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'JPEG' | 'PNG' | 'WEBP';
  targetSizeKB?: number;
}

export interface CompressionResult {
  uri: string;
  width: number;
  height: number;
  size: number;
  originalSize: number;
  compressionRatio: number;
}

class ImageCompressionService {
  private static instance: ImageCompressionService;
  
  // Default compression settings
  private readonly defaultOptions: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    format: 'JPEG',
    targetSizeKB: 2048, // 2MB target
  };

  public static getInstance(): ImageCompressionService {
    if (!ImageCompressionService.instance) {
      ImageCompressionService.instance = new ImageCompressionService();
    }
    return ImageCompressionService.instance;
  }

  /**
   * Compress image with smart quality adjustment
   */
  public async compressImage(
    imagePath: string,
    options?: CompressionOptions
  ): Promise<CompressionResult> {
    const config = { ...this.defaultOptions, ...options };
    
    try {
      // Get original image stats
      const originalStats = await RNFS.stat(imagePath);
      const originalSize = originalStats.size;
      
      // If already small enough, just copy
      if (originalSize <= (config.targetSizeKB! * 1024)) {
        return {
          uri: imagePath,
          width: 0, // Would need image dimensions library
          height: 0,
          size: originalSize,
          originalSize,
          compressionRatio: 0,
        };
      }

      let quality = config.quality!;
      let compressedResult;
      let attempts = 0;
      const maxAttempts = 5;

      // Iteratively compress until target size is reached
      do {
        compressedResult = await ImageResizer.createResizedImage(
          imagePath,
          config.maxWidth!,
          config.maxHeight!,
          config.format!,
          quality,
          0, // rotation
          undefined, // outputPath
          false, // keepMeta
          {
            mode: 'contain',
            onlyScaleDown: true,
          }
        );

        const compressedStats = await RNFS.stat(compressedResult.uri);
        const compressedSize = compressedStats.size;

        // Check if target size is reached
        if (compressedSize <= (config.targetSizeKB! * 1024)) {
          break;
        }

        // Reduce quality for next attempt
        quality = Math.max(20, quality - 15);
        attempts++;
        
        // Clean up previous attempt
        if (compressedResult.uri !== imagePath) {
          await RNFS.unlink(compressedResult.uri).catch(() => {
            // Ignore cleanup errors
          });
        }
        
      } while (attempts < maxAttempts && quality > 20);

      // Final result
      const finalStats = await RNFS.stat(compressedResult.uri);
      const finalSize = finalStats.size;
      const compressionRatio = (originalSize - finalSize) / originalSize;

      console.log(`✅ Image compressed: ${this.formatFileSize(originalSize)} → ${this.formatFileSize(finalSize)} (${(compressionRatio * 100).toFixed(1)}%)`);

      return {
        uri: compressedResult.uri,
        width: compressedResult.width,
        height: compressedResult.height,
        size: finalSize,
        originalSize,
        compressionRatio,
      };
    } catch (error) {
      console.error('❌ Image compression failed:', error);
      throw new Error(`Image compression failed: ${error}`);
    }
  }

  /**
   * Compress image for thumbnail generation
   */
  public async createThumbnail(
    imagePath: string,
    maxSize: number = 300
  ): Promise<CompressionResult> {
    return this.compressImage(imagePath, {
      maxWidth: maxSize,
      maxHeight: maxSize,
      quality: 70,
      format: 'JPEG',
      targetSizeKB: 100, // 100KB for thumbnails
    });
  }

  /**
   * Compress multiple images in batch
   */
  public async compressImagesBatch(
    imagePaths: string[],
    options?: CompressionOptions,
    onProgress?: (completed: number, total: number) => void
  ): Promise<CompressionResult[]> {
    const results: CompressionResult[] = [];
    
    for (let i = 0; i < imagePaths.length; i++) {
      try {
        const result = await this.compressImage(imagePaths[i], options);
        results.push(result);
        
        if (onProgress) {
          onProgress(i + 1, imagePaths.length);
        }
      } catch (error) {
        console.error(`❌ Failed to compress image ${i + 1}:`, error);
        // Continue with other images
      }
    }
    
    return results;
  }

  /**
   * Get optimal compression settings based on image size
   */
  public async getOptimalSettings(imagePath: string): Promise<CompressionOptions> {
    try {
      const stats = await RNFS.stat(imagePath);
      const sizeKB = stats.size / 1024;
      
      if (sizeKB < 500) {
        // Small image - minimal compression
        return {
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 85,
          format: 'JPEG',
          targetSizeKB: 1024,
        };
      } else if (sizeKB < 2000) {
        // Medium image - moderate compression
        return {
          maxWidth: 1600,
          maxHeight: 1200,
          quality: 75,
          format: 'JPEG',
          targetSizeKB: 1536,
        };
      } else {
        // Large image - aggressive compression
        return {
          maxWidth: 1280,
          maxHeight: 960,
          quality: 65,
          format: 'JPEG',
          targetSizeKB: 2048,
        };
      }
    } catch (error) {
      console.error('❌ Failed to get optimal settings:', error);
      return this.defaultOptions;
    }
  }

  /**
   * Validate image before compression
   */
  public async validateImage(imagePath: string): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];
    
    try {
      const exists = await RNFS.exists(imagePath);
      if (!exists) {
        errors.push('Image file does not exist');
        return { isValid: false, errors };
      }

      const stats = await RNFS.stat(imagePath);
      const sizeBytes = stats.size;
      
      if (sizeBytes === 0) {
        errors.push('Image file is empty');
      }
      
      if (sizeBytes > 100 * 1024 * 1024) { // 100MB
        errors.push('Image file is too large (max 100MB)');
      }
      
      // Check file extension
      const extension = imagePath.toLowerCase().split('.').pop();
      const validExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      if (!extension || !validExtensions.includes(extension)) {
        errors.push(`Invalid image format. Supported: ${validExtensions.join(', ')}`);
      }
      
    } catch (error) {
      errors.push(`Image validation failed: ${error}`);
    }
    
    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Calculate compression statistics
   */
  public calculateCompressionStats(results: CompressionResult[]): {
    totalOriginalSize: number;
    totalCompressedSize: number;
    totalCompressionRatio: number;
    averageCompressionRatio: number;
    spaceSaved: number;
  } {
    const totalOriginalSize = results.reduce((sum, result) => sum + result.originalSize, 0);
    const totalCompressedSize = results.reduce((sum, result) => sum + result.size, 0);
    const totalCompressionRatio = (totalOriginalSize - totalCompressedSize) / totalOriginalSize;
    const averageCompressionRatio = results.reduce((sum, result) => sum + result.compressionRatio, 0) / results.length;
    const spaceSaved = totalOriginalSize - totalCompressedSize;
    
    return {
      totalOriginalSize,
      totalCompressedSize,
      totalCompressionRatio,
      averageCompressionRatio,
      spaceSaved,
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
   * Clean up temporary compressed files
   */
  public async cleanupTempFiles(filePaths: string[]): Promise<void> {
    try {
      for (const filePath of filePaths) {
        const exists = await RNFS.exists(filePath);
        if (exists) {
          await RNFS.unlink(filePath);
        }
      }
      console.log(`✅ Cleaned up ${filePaths.length} temporary files`);
    } catch (error) {
      console.error('❌ Temp file cleanup failed:', error);
    }
  }
}

export default ImageCompressionService;