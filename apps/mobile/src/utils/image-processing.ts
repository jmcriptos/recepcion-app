import { Platform } from 'react-native';
import { CapturedImage, ImageProcessingResult } from '../types/camera';

export interface CompressionOptions {
  maxFileSizeMB: number;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  format: 'JPEG' | 'PNG';
}

export const DEFAULT_COMPRESSION_OPTIONS: CompressionOptions = {
  maxFileSizeMB: 2, // 2MB max for efficient transmission
  quality: 0.85, // 85% quality maintains OCR effectiveness
  maxWidth: 2048,
  maxHeight: 2048,
  format: 'JPEG',
};

/**
 * Compresses an image to optimize for transmission while maintaining OCR quality
 */
export const compressImage = async (
  image: CapturedImage,
  options: Partial<CompressionOptions> = {}
): Promise<ImageProcessingResult> => {
  const startTime = Date.now();
  const compressionOptions = { ...DEFAULT_COMPRESSION_OPTIONS, ...options };
  
  try {
    // Simulate image compression (in real implementation, would use react-native-image-resizer)
    const originalSize = image.fileSize || 0;
    
    // Calculate compression ratio based on quality and size constraints
    let compressionRatio = 1;
    if (originalSize > compressionOptions.maxFileSizeMB * 1024 * 1024) {
      compressionRatio = (compressionOptions.maxFileSizeMB * 1024 * 1024) / originalSize;
    }
    
    // Apply quality compression
    compressionRatio *= compressionOptions.quality;
    
    const compressedSize = Math.floor(originalSize * compressionRatio);
    const processingTime = Date.now() - startTime;
    
    // For now, return the original URI (in production, would return compressed image URI)
    const result: ImageProcessingResult = {
      compressedUri: image.uri,
      originalSize,
      compressedSize,
      compressionRatio: originalSize > 0 ? compressedSize / originalSize : 1,
      processingTime,
    };
    
    return result;
  } catch (error) {
    throw new Error(`Image compression failed: ${error}`);
  }
};

/**
 * Validates if an image meets OCR quality requirements
 */
export const validateImageForOCR = (image: CapturedImage): {
  isValid: boolean;
  issues: string[];
  recommendations: string[];
} => {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Check file size
  if (image.fileSize) {
    const fileSizeMB = image.fileSize / (1024 * 1024);
    if (fileSizeMB < 0.5) {
      issues.push('Archivo muy pequeño (menos de 0.5MB)');
      recommendations.push('Tomar foto con mayor calidad');
    }
    if (fileSizeMB > 10) {
      issues.push('Archivo muy grande (más de 10MB)');
      recommendations.push('La imagen será comprimida automáticamente');
    }
  }
  
  // Check dimensions
  if (image.width && image.height) {
    const megapixels = (image.width * image.height) / 1000000;
    if (megapixels < 3) {
      issues.push('Resolución baja (menos de 3MP)');
      recommendations.push('Usar cámara trasera con mayor resolución');
    }
  }
  
  // Check aspect ratio for label scanning
  if (image.width && image.height) {
    const aspectRatio = image.width / image.height;
    if (aspectRatio < 0.5 || aspectRatio > 3) {
      issues.push('Proporción de imagen no óptima para etiquetas');
      recommendations.push('Enfocar más cerca de la etiqueta');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
  };
};

/**
 * Calculates optimal compression settings based on image properties
 */
export const calculateOptimalCompression = (
  image: CapturedImage,
  targetSizeMB: number = 2
): CompressionOptions => {
  const originalSizeMB = image.fileSize ? image.fileSize / (1024 * 1024) : 5;
  
  let quality = 0.85; // Start with 85% quality
  
  // Adjust quality based on original size
  if (originalSizeMB > targetSizeMB * 2) {
    quality = 0.75; // Lower quality for very large images
  } else if (originalSizeMB < targetSizeMB) {
    quality = 0.95; // Higher quality for smaller images
  }
  
  // Calculate max dimensions to maintain aspect ratio
  let maxWidth = 2048;
  let maxHeight = 2048;
  
  if (image.width && image.height) {
    const aspectRatio = image.width / image.height;
    if (aspectRatio > 1) {
      // Landscape
      maxHeight = Math.floor(maxWidth / aspectRatio);
    } else {
      // Portrait
      maxWidth = Math.floor(maxHeight * aspectRatio);
    }
  }
  
  return {
    maxFileSizeMB: targetSizeMB,
    quality,
    maxWidth,
    maxHeight,
    format: 'JPEG',
  };
};

/**
 * Generates a progressive JPEG for faster loading
 */
export const generateProgressiveJPEG = async (
  imageUri: string
): Promise<string> => {
  try {
    // In production, would use image processing library to create progressive JPEG
    // For now, return the original URI
    return imageUri;
  } catch (error) {
    throw new Error(`Progressive JPEG generation failed: ${error}`);
  }
};

/**
 * Estimates the OCR processing performance based on image characteristics
 */
export const estimateOCRPerformance = (image: CapturedImage): {
  expectedAccuracy: 'high' | 'medium' | 'low';
  processingTime: 'fast' | 'medium' | 'slow';
  confidence: number;
} => {
  let confidence = 0.8; // Start with 80% confidence
  
  // Factor in file size
  if (image.fileSize) {
    const fileSizeMB = image.fileSize / (1024 * 1024);
    if (fileSizeMB >= 2 && fileSizeMB <= 5) {
      confidence += 0.1; // Optimal size range
    } else if (fileSizeMB < 1 || fileSizeMB > 8) {
      confidence -= 0.2; // Suboptimal size
    }
  }
  
  // Factor in dimensions
  if (image.width && image.height) {
    const megapixels = (image.width * image.height) / 1000000;
    if (megapixels >= 8) {
      confidence += 0.1; // High resolution good for OCR
    } else if (megapixels < 3) {
      confidence -= 0.3; // Low resolution poor for OCR
    }
  }
  
  // Determine categories based on confidence
  const expectedAccuracy = confidence >= 0.8 ? 'high' : confidence >= 0.6 ? 'medium' : 'low';
  const processingTime = confidence >= 0.8 ? 'fast' : confidence >= 0.6 ? 'medium' : 'slow';
  
  return {
    expectedAccuracy,
    processingTime,
    confidence: Math.max(0, Math.min(1, confidence)),
  };
};

/**
 * Utility to format file sizes for display
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Utility to calculate compression percentage
 */
export const calculateCompressionPercentage = (
  originalSize: number,
  compressedSize: number
): number => {
  if (originalSize === 0) return 0;
  return Math.round(((originalSize - compressedSize) / originalSize) * 100);
};