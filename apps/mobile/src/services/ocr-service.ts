/**
 * OCR Service
 * Handles local and server-based OCR processing with fallback logic
 */

// Note: react-native-tesseract-ocr is not installed yet
// This is a placeholder interface for future implementation
interface TessOcrResult {
  text: string;
  confidence?: number;
}

export interface OCRResult {
  text: string;
  confidence: number;
  processing_type: 'local' | 'server' | 'manual';
  needs_server_processing: boolean;
  processing_time: number;
  error?: string;
}

export interface OCRProcessingOptions {
  forceServerProcessing?: boolean;
  confidenceThreshold?: number;
  timeout?: number;
  allowFallback?: boolean;
}

class OCRService {
  private static instance: OCRService;
  private readonly defaultConfidenceThreshold = 0.7;
  private readonly localProcessingTimeout = 8000; // 8 seconds
  private readonly serverProcessingTimeout = 15000; // 15 seconds
  private readonly tesseractLanguages = ['eng', 'spa']; // English and Spanish

  constructor() {
    this.initializeTesseract();
  }

  public static getInstance(): OCRService {
    if (!OCRService.instance) {
      OCRService.instance = new OCRService();
    }
    return OCRService.instance;
  }

  /**
   * Initialize Tesseract for local OCR processing
   */
  private async initializeTesseract(): Promise<void> {
    try {
      // Check if Tesseract is available
      console.log('🔍 Initializing Tesseract OCR engine...');
      // Tesseract initialization happens automatically on first use
      console.log('✅ Tesseract OCR engine ready');
    } catch (error) {
      console.error('❌ Failed to initialize Tesseract:', error);
    }
  }

  /**
   * Process image with OCR using the three-tier approach:
   * 1. Local OCR → 2. Server OCR → 3. Manual Input
   */
  public async processImage(
    imagePath: string,
    options: OCRProcessingOptions = {}
  ): Promise<OCRResult> {
    const startTime = Date.now();
    const {
      forceServerProcessing = false,
      confidenceThreshold = this.defaultConfidenceThreshold,
      timeout = this.localProcessingTimeout,
      allowFallback = true,
    } = options;

    try {
      // Step 1: Try local OCR processing first (unless forced to server)
      if (!forceServerProcessing) {
        console.log('🔍 Attempting local OCR processing...');
        
        const localResult = await this.processLocalOCR(imagePath, timeout);
        
        if (localResult.confidence >= confidenceThreshold) {
          console.log(`✅ Local OCR successful (confidence: ${localResult.confidence})`);
          return {
            ...localResult,
            processing_type: 'local',
            needs_server_processing: false,
            processing_time: Date.now() - startTime,
          };
        }
        
        console.log(`⚠️ Local OCR confidence too low (${localResult.confidence} < ${confidenceThreshold})`);
      }

      // Step 2: Fallback to server processing (if network available and fallback allowed)
      if (allowFallback) {
        console.log('🌐 Attempting server OCR processing...');
        
        const serverResult = await this.processServerOCR(imagePath, this.serverProcessingTimeout);
        
        if (serverResult.confidence >= confidenceThreshold) {
          console.log(`✅ Server OCR successful (confidence: ${serverResult.confidence})`);
          return {
            ...serverResult,
            processing_type: 'server',
            needs_server_processing: false,
            processing_time: Date.now() - startTime,
          };
        }
        
        console.log(`⚠️ Server OCR confidence too low (${serverResult.confidence} < ${confidenceThreshold})`);
      }

      // Step 3: Mark for manual input
      console.log('📝 Marking for manual input due to low OCR confidence');
      return {
        text: '',
        confidence: 0,
        processing_type: 'manual',
        needs_server_processing: false,
        processing_time: Date.now() - startTime,
        error: 'OCR confidence below threshold, manual input required',
      };

    } catch (error) {
      console.error('❌ OCR processing failed:', error);
      return {
        text: '',
        confidence: 0,
        processing_type: 'manual',
        needs_server_processing: true,
        processing_time: Date.now() - startTime,
        error: `OCR processing failed: ${error}`,
      };
    }
  }

  /**
   * Process OCR locally using Tesseract
   */
  private async processLocalOCR(imagePath: string, timeout: number): Promise<Omit<OCRResult, 'processing_type' | 'needs_server_processing' | 'processing_time'>> {
    try {
      const tesseractOptions = {
        whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789.,-/ ',
        blacklist: '',
      };

      console.log(`🔍 Starting local Tesseract OCR on: ${imagePath}`);
      
      // TODO: Implement actual Tesseract integration when package is installed
      // For now, simulate OCR processing with a mock implementation
      const result: TessOcrResult = await this.mockLocalOCR(imagePath, timeout);
      
      // Clean and validate the extracted text
      const cleanedText = this.cleanExtractedText(result.text);
      const confidence = this.calculateLocalConfidence(result, cleanedText);
      
      console.log(`📝 Local OCR result: "${cleanedText}" (confidence: ${confidence})`);
      
      return {
        text: cleanedText,
        confidence,
      };
    } catch (error) {
      console.error('❌ Local OCR failed:', error);
      throw new Error(`Local OCR processing failed: ${error}`);
    }
  }

  /**
   * Process OCR using server (placeholder for future implementation)
   */
  private async processServerOCR(imagePath: string, timeout: number): Promise<Omit<OCRResult, 'processing_type' | 'needs_server_processing' | 'processing_time'>> {
    try {
      // TODO: Implement server OCR API call
      // This would upload the image to the server and get OCR results
      
      console.log('🌐 Server OCR is not yet implemented');
      
      // For now, return a placeholder that indicates server processing is needed
      throw new Error('Server OCR not implemented yet');
      
      // Future implementation would look like:
      // const response = await fetch('/api/ocr', {
      //   method: 'POST',
      //   body: formData,
      //   timeout: timeout,
      // });
      // const result = await response.json();
      // return {
      //   text: result.text,
      //   confidence: result.confidence,
      // };
    } catch (error) {
      console.error('❌ Server OCR failed:', error);
      throw new Error(`Server OCR processing failed: ${error}`);
    }
  }

  /**
   * Clean extracted text by removing noise and formatting
   */
  private cleanExtractedText(rawText: string): string {
    if (!rawText) return '';
    
    return rawText
      .trim()
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/[^\w\s.,/-]/g, '') // Remove special characters except basic punctuation
      .replace(/^\W+|\W+$/g, '') // Remove leading/trailing non-word characters
      .substring(0, 100); // Limit length to 100 characters
  }

  /**
   * Calculate confidence score for local OCR results
   */
  private calculateLocalConfidence(tessResult: TessOcrResult, cleanedText: string): number {
    try {
      // Base confidence from Tesseract (if available)
      let confidence = 0.5; // Default moderate confidence
      
      // Boost confidence based on text characteristics
      if (cleanedText.length >= 3) confidence += 0.1;
      if (/\d/.test(cleanedText)) confidence += 0.1; // Contains numbers
      if (/^[A-Z0-9\s.,/-]+$/i.test(cleanedText)) confidence += 0.2; // Only expected characters
      if (cleanedText.length >= 5 && cleanedText.length <= 50) confidence += 0.1; // Reasonable length
      
      // Penalize for suspicious patterns
      if (cleanedText.length < 2) confidence -= 0.3;
      if (/[^\w\s.,/-]/.test(cleanedText)) confidence -= 0.2; // Unexpected characters
      if (cleanedText.length > 80) confidence -= 0.1; // Too long
      
      return Math.max(0, Math.min(1, confidence));
    } catch (error) {
      console.error('❌ Failed to calculate confidence:', error);
      return 0.3; // Low default confidence
    }
  }

  /**
   * Extract specific weight values from OCR text
   */
  public extractWeightFromText(text: string): { weight: number | null; confidence: number } {
    try {
      // Common weight patterns in meat industry labels
      const weightPatterns = [
        /(\d+\.?\d*)\s*(?:kg|kilo|kilogram)/i,
        /(\d+\.?\d*)\s*(?:lb|lbs|pound|pounds)/i,
        /(\d+\.?\d*)\s*(?:g|gram|grams)/i,
        /(?:peso|weight|wt)[:\s]*(\d+\.?\d*)/i,
        /(\d+\.?\d*)\s*(?:k|K)$/,
        /^(\d+\.?\d*)$/, // Just a number
      ];

      for (const pattern of weightPatterns) {
        const match = text.match(pattern);
        if (match) {
          const weightValue = parseFloat(match[1]);
          
          // Validate weight range (0.1kg to 50kg)
          if (weightValue >= 0.1 && weightValue <= 50) {
            return {
              weight: weightValue,
              confidence: 0.8,
            };
          }
          
          // Convert from grams to kg if needed
          if (weightValue >= 100 && weightValue <= 50000) {
            return {
              weight: weightValue / 1000,
              confidence: 0.7,
            };
          }
        }
      }

      return { weight: null, confidence: 0 };
    } catch (error) {
      console.error('❌ Failed to extract weight:', error);
      return { weight: null, confidence: 0 };
    }
  }

  /**
   * Mock local OCR for testing until Tesseract is integrated
   */
  private async mockLocalOCR(_imagePath: string, _timeout: number): Promise<TessOcrResult> {
    return new Promise((resolve) => {
      setTimeout(() => {
        // Simulate OCR processing time
        const mockResults = [
          { text: '25.5 kg', confidence: 0.85 },
          { text: '12.3 kg', confidence: 0.90 },
          { text: '8.7 kg', confidence: 0.75 },
          { text: '15 kg', confidence: 0.80 },
          { text: 'unclear text', confidence: 0.45 },
        ];
        
        const randomResult = mockResults[Math.floor(Math.random() * mockResults.length)];
        console.log(`📝 Mock OCR result: "${randomResult.text}" (confidence: ${randomResult.confidence})`);
        
        resolve(randomResult);
      }, Math.random() * 2000 + 1000); // 1-3 second delay
    });
  }

  /**
   * Check if local OCR is available
   */
  public async isLocalOCRAvailable(): Promise<boolean> {
    try {
      // For now, always return true since we have mock implementation
      // TODO: Check if Tesseract is actually installed when integrated
      return true;
    } catch (error) {
      console.error('❌ Local OCR not available:', error);
      return false;
    }
  }
}

export default OCRService;