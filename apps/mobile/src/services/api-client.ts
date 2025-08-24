/**
 * API Client Service
 * Centralized API communication for sync operations
 * Handles registration creation, photo uploads, and user updates
 */

import { 
  CreateRegistrationPayload, 
  UploadPhotoPayload, 
  UpdateUserPayload,
  LocalWeightRegistration 
} from '../types/offline';

interface RegistrationCreateResponse {
  id: string;
  weight: number;
  cut_type: 'jamón' | 'chuleta';
  supplier: string;
  photo_url?: string;
  ocr_confidence?: number;
  registered_by: string;
  created_at: string;
  updated_at: string;
}

interface PhotoUploadResponse {
  photo_url: string;
  ocr_result?: {
    text: string;
    confidence: number;
    weight?: number;
  };
}

interface UserUpdateResponse {
  id: string;
  last_login: string;
}

interface ErrorResponse {
  error: {
    message: string;
    code: string;
  };
}

class ApiClient {
  private baseURL: string;
  private timeout: number;
  private readonly maxRetries: number = 3;
  private readonly retryDelays: number[] = [1000, 2000, 4000];

  constructor() {
    // Production API URL pointing to Heroku deployment
    this.baseURL = 'https://chatclg.herokuapp.com/api/v1';
    this.timeout = 30000; // 30 seconds for sync operations (longer than auth)
  }

  /**
   * Create a weight registration on the server
   */
  async createRegistration(payload: CreateRegistrationPayload): Promise<RegistrationCreateResponse> {
    try {
      const requestBody = {
        weight: payload.weight,
        cut_type: payload.cut_type,
        supplier: payload.supplier,
        registered_by: payload.registered_by,
      };

      const response = await this.makeRequestWithRetry('/registrations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(`Registration creation failed: ${errorData.error.message}`);
      }

      const registrationData: RegistrationCreateResponse = await response.json();
      return registrationData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to create registration on server');
    }
  }

  /**
   * Upload a photo to the server for OCR processing
   */
  async uploadPhoto(payload: UploadPhotoPayload): Promise<PhotoUploadResponse> {
    try {
      // Create FormData for file upload
      const formData = new FormData();
      
      // In React Native, we need to create a proper file object
      const photoFile = {
        uri: payload.compressed_photo_path,
        type: 'image/jpeg',
        name: `${payload.registration_id}_photo.jpg`,
      } as any;

      formData.append('image', photoFile);
      formData.append('registration_id', payload.registration_id);

      const response = await this.makeRequestWithRetry('/ocr/process-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
        // Don't set Content-Type header, let the browser set it with boundary
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(`Photo upload failed: ${errorData.error.message}`);
      }

      const photoData: PhotoUploadResponse = await response.json();
      return photoData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to upload photo to server');
    }
  }

  /**
   * Update user information on the server
   */
  async updateUser(payload: UpdateUserPayload): Promise<UserUpdateResponse> {
    try {
      const requestBody = {
        last_login: payload.last_login,
      };

      const response = await this.makeRequestWithRetry(`/users/${payload.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        credentials: 'include',
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(`User update failed: ${errorData.error.message}`);
      }

      const userData: UserUpdateResponse = await response.json();
      return userData;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update user on server');
    }
  }

  /**
   * Validate session before sync operations
   */
  async validateSession(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/auth/current-user', {
        method: 'GET',
        credentials: 'include',
      });

      return response.ok;
    } catch (error) {
      console.warn('Session validation failed:', error);
      return false;
    }
  }

  /**
   * Get registration by ID (for conflict resolution)
   */
  async getRegistrationById(registrationId: string): Promise<LocalWeightRegistration | null> {
    try {
      const response = await this.makeRequest(`/registrations/${registrationId}`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        if (response.status === 404) {
          return null; // Registration not found
        }
        const errorData: ErrorResponse = await response.json();
        throw new Error(`Failed to fetch registration: ${errorData.error.message}`);
      }

      const registration: LocalWeightRegistration = await response.json();
      return registration;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to fetch registration from server');
    }
  }

  /**
   * Check server health
   */
  async checkServerHealth(): Promise<boolean> {
    try {
      const response = await this.makeRequest('/health', {
        method: 'GET',
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  /**
   * Make HTTP request with retry logic
   */
  private async makeRequestWithRetry(
    endpoint: string,
    options: RequestInit,
    retryCount: number = 0
  ): Promise<Response> {
    try {
      const response = await this.makeRequest(endpoint, options);
      
      // If the request was successful or it's a client error (4xx), don't retry
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // For server errors (5xx), retry if we haven't exceeded max retries
      if (retryCount < this.maxRetries && response.status >= 500) {
        const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
        console.log(`🔄 Retrying request in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        await this.delay(delay);
        return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
      }

      return response;
    } catch (error) {
      // For network errors, retry if we haven't exceeded max retries
      if (retryCount < this.maxRetries && this.isNetworkError(error)) {
        const delay = this.retryDelays[retryCount] || this.retryDelays[this.retryDelays.length - 1];
        console.log(`🔄 Retrying after network error in ${delay}ms (attempt ${retryCount + 1}/${this.maxRetries})`);
        
        await this.delay(delay);
        return this.makeRequestWithRetry(endpoint, options, retryCount + 1);
      }

      throw error;
    }
  }

  /**
   * Make HTTP request with timeout and error handling
   */
  private async makeRequest(
    endpoint: string,
    options: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request timeout - server took too long to respond');
        }
        if (error.message.includes('Network request failed')) {
          throw new Error('Network request failed - check internet connection');
        }
        if (error.message.includes('fetch')) {
          throw new Error('Connection error - unable to reach server');
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if error is a network-related error that should be retried
   */
  private isNetworkError(error: any): boolean {
    if (!(error instanceof Error)) return false;
    
    const networkErrorMessages = [
      'Network request failed',
      'Connection error',
      'fetch',
      'NETWORK_ERROR',
      'CONNECTION_ERROR',
    ];

    return networkErrorMessages.some(message => 
      error.message.includes(message) || error.name.includes(message)
    );
  }

  /**
   * Utility method for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update base URL for different environments
   */
  public setBaseURL(url: string): void {
    this.baseURL = url;
  }

  /**
   * Get current base URL
   */
  public getBaseURL(): string {
    return this.baseURL;
  }

  /**
   * Update timeout configuration
   */
  public setTimeout(ms: number): void {
    this.timeout = ms;
  }
}

// Export singleton instance
export const apiClient = new ApiClient();
export default apiClient;