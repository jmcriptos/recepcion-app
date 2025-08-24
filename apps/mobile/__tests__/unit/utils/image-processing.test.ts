import {
  compressImage,
  validateImageForOCR,
  calculateOptimalCompression,
  estimateOCRPerformance,
  formatFileSize,
  calculateCompressionPercentage,
  DEFAULT_COMPRESSION_OPTIONS,
} from '../../../src/utils/image-processing';
import { CapturedImage } from '../../../src/types/camera';

describe('Image Processing Utils', () => {
  const mockImage: CapturedImage = {
    uri: 'file://test-image.jpg',
    fileName: 'test-image.jpg',
    fileSize: 5 * 1024 * 1024, // 5MB
    type: 'image/jpeg',
    width: 3000,
    height: 2250, // 6.75MP
    timestamp: Date.now(),
  };

  describe('compressImage', () => {
    it('compresses large images to target size', async () => {
      const result = await compressImage(mockImage);
      
      expect(result.originalSize).toBe(mockImage.fileSize);
      expect(result.compressedSize).toBeLessThanOrEqual(DEFAULT_COMPRESSION_OPTIONS.maxFileSizeMB * 1024 * 1024);
      expect(result.compressionRatio).toBeLessThanOrEqual(1);
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.compressedUri).toBeTruthy();
    });

    it('handles custom compression options', async () => {
      const customOptions = {
        maxFileSizeMB: 1,
        quality: 0.7,
      };
      
      const result = await compressImage(mockImage, customOptions);
      
      expect(result.compressedSize).toBeLessThanOrEqual(1 * 1024 * 1024);
    });

    it('handles compression errors gracefully', async () => {
      const invalidImage = { ...mockImage, uri: '' };
      
      await expect(compressImage(invalidImage)).rejects.toThrow('Image compression failed');
    });
  });

  describe('validateImageForOCR', () => {
    it('validates good quality images', () => {
      const result = validateImageForOCR(mockImage);
      
      expect(result.isValid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.recommendations).toHaveLength(0);
    });

    it('identifies low resolution issues', () => {
      const lowResImage = {
        ...mockImage,
        width: 1000,
        height: 750, // 0.75MP
      };
      
      const result = validateImageForOCR(lowResImage);
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Resolución baja (menos de 3MP)');
      expect(result.recommendations).toContain('Usar cámara trasera con mayor resolución');
    });

    it('identifies small file size issues', () => {
      const smallImage = {
        ...mockImage,
        fileSize: 0.3 * 1024 * 1024, // 0.3MB
      };
      
      const result = validateImageForOCR(smallImage);
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Archivo muy pequeño (menos de 0.5MB)');
    });

    it('identifies extreme aspect ratio issues', () => {
      const extremeAspectImage = {
        ...mockImage,
        width: 1000,
        height: 5000, // Very tall aspect ratio
      };
      
      const result = validateImageForOCR(extremeAspectImage);
      
      expect(result.isValid).toBe(false);
      expect(result.issues).toContain('Proporción de imagen no óptima para etiquetas');
    });
  });

  describe('estimateOCRPerformance', () => {
    it('estimates high performance for good quality images', () => {
      const result = estimateOCRPerformance(mockImage);
      
      expect(result.expectedAccuracy).toBe('high');
      expect(result.processingTime).toBe('fast');
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('estimates poor performance for low quality images', () => {
      const poorImage = {
        ...mockImage,
        width: 800,
        height: 600, // Low resolution
        fileSize: 0.2 * 1024 * 1024, // Small file
      };
      
      const result = estimateOCRPerformance(poorImage);
      
      expect(result.expectedAccuracy).toBe('low');
      expect(result.processingTime).toBe('slow');
      expect(result.confidence).toBeLessThan(0.6);
    });
  });

  describe('calculateOptimalCompression', () => {
    it('calculates appropriate compression for large images', () => {
      const result = calculateOptimalCompression(mockImage, 2);
      
      expect(result.maxFileSizeMB).toBe(2);
      expect(result.quality).toBeLessThan(0.85); // Should reduce quality for large images
      expect(result.format).toBe('JPEG');
    });

    it('maintains higher quality for smaller images', () => {
      const smallImage = {
        ...mockImage,
        fileSize: 1 * 1024 * 1024, // 1MB
      };
      
      const result = calculateOptimalCompression(smallImage, 2);
      
      expect(result.quality).toBeGreaterThan(0.9); // Should maintain higher quality
    });

    it('calculates aspect-ratio-appropriate dimensions', () => {
      const wideImage = {
        ...mockImage,
        width: 4000,
        height: 2000, // 2:1 aspect ratio
      };
      
      const result = calculateOptimalCompression(wideImage);
      
      expect(result.maxWidth).toBe(2048);
      expect(result.maxHeight).toBe(1024); // Maintains aspect ratio
    });
  });

  describe('formatFileSize', () => {
    it('formats bytes correctly', () => {
      expect(formatFileSize(0)).toBe('0 Bytes');
      expect(formatFileSize(1024)).toBe('1 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
      expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
    });
  });

  describe('calculateCompressionPercentage', () => {
    it('calculates compression percentage correctly', () => {
      expect(calculateCompressionPercentage(100, 50)).toBe(50);
      expect(calculateCompressionPercentage(1000, 250)).toBe(75);
      expect(calculateCompressionPercentage(0, 0)).toBe(0);
      expect(calculateCompressionPercentage(100, 100)).toBe(0);
    });

    it('handles edge cases', () => {
      expect(calculateCompressionPercentage(0, 50)).toBe(0);
      expect(calculateCompressionPercentage(100, 0)).toBe(100);
    });
  });

  describe('DEFAULT_COMPRESSION_OPTIONS', () => {
    it('has appropriate default values for OCR', () => {
      expect(DEFAULT_COMPRESSION_OPTIONS.maxFileSizeMB).toBe(2);
      expect(DEFAULT_COMPRESSION_OPTIONS.quality).toBe(0.85);
      expect(DEFAULT_COMPRESSION_OPTIONS.format).toBe('JPEG');
      expect(DEFAULT_COMPRESSION_OPTIONS.maxWidth).toBe(2048);
      expect(DEFAULT_COMPRESSION_OPTIONS.maxHeight).toBe(2048);
    });
  });
});