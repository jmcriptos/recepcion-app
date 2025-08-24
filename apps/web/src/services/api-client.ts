/**
 * API Client - Web Version
 * HTTP client for communicating with the Flask backend
 * Simplified for web environment
 */

import axios, { type AxiosInstance, type AxiosResponse } from 'axios';
import { type User, type LoginRequest, type LoginResponse } from '../types/auth';

// API Configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';
const API_TIMEOUT = 10000; // 10 seconds

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: API_TIMEOUT,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth headers if needed
    this.client.interceptors.request.use(
      (config) => {
        // TODO: Add authentication headers when user is logged in
        const userStr = localStorage.getItem('meat_reception_user');
        if (userStr) {
          try {
            const user = JSON.parse(userStr);
            config.headers['X-User-ID'] = user.id;
          } catch (error) {
            console.warn('Failed to parse stored user data');
          }
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response;
      },
      (error) => {
        console.error('API Error:', error);
        
        // Handle network errors
        if (!error.response) {
          throw new Error('No se pudo conectar con el servidor. Verifica tu conexión a internet.');
        }

        // Handle HTTP error responses
        const { status, data } = error.response;
        
        switch (status) {
          case 401:
            throw new Error('No autorizado. Por favor, inicia sesión nuevamente.');
          case 403:
            throw new Error('No tienes permisos para realizar esta acción.');
          case 404:
            throw new Error('Recurso no encontrado.');
          case 500:
            throw new Error('Error interno del servidor. Por favor, intenta nuevamente.');
          default:
            throw new Error(data?.message || `Error ${status}: ${error.message}`);
        }
      }
    );
  }

  // Health check
  async ping(): Promise<any> {
    try {
      const response = await this.client.get('/ping');
      return response.data;
    } catch (error) {
      console.warn('Health check failed:', error);
      throw error;
    }
  }

  // Authentication methods
  async login(name: string): Promise<LoginResponse> {
    try {
      const payload: LoginRequest = { name };
      const response = await this.client.post('/auth/login', payload);
      return response.data;
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/auth/logout');
    } catch (error) {
      console.error('Logout failed:', error);
      // Don't throw error on logout failure - we still want to clear local session
    }
  }

  async getCurrentUser(): Promise<User> {
    try {
      const response = await this.client.get('/auth/current-user');
      return response.data.user;
    } catch (error) {
      console.error('Get current user failed:', error);
      throw error;
    }
  }

  async checkSession(): Promise<boolean> {
    try {
      const response = await this.client.get('/auth/current-user');
      return response.status === 200 && !!response.data.user;
    } catch (error) {
      return false;
    }
  }

  // Users management (for supervisors)
  async getUsers(): Promise<User[]> {
    try {
      const response = await this.client.get('/users');
      return response.data.users || [];
    } catch (error) {
      console.error('Get users failed:', error);
      throw error;
    }
  }

  // Weight registrations
  async createRegistration(data: any): Promise<any> {
    try {
      const response = await this.client.post('/registrations', data);
      return response.data;
    } catch (error) {
      console.error('Create registration failed:', error);
      throw error;
    }
  }

  async getRegistrations(params?: { 
    limit?: number; 
    offset?: number; 
    supplier?: string; 
    cut_type?: string;
    date_from?: string;
    date_to?: string;
  }): Promise<any> {
    try {
      const response = await this.client.get('/registrations', { params });
      return response.data;
    } catch (error) {
      console.error('Get registrations failed:', error);
      throw error;
    }
  }

  async getTodayRegistrations(): Promise<any> {
    try {
      const response = await this.client.get('/registrations/today');
      return response.data;
    } catch (error) {
      console.error('Get today registrations failed:', error);
      throw error;
    }
  }

  // OCR processing
  async processImage(imageFile: File): Promise<any> {
    try {
      const formData = new FormData();
      formData.append('image', imageFile);

      const response = await this.client.post('/ocr/process-image', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      console.error('OCR processing failed:', error);
      throw error;
    }
  }

  // Dashboard and reports (supervisor only)
  async getDashboardData(): Promise<any> {
    try {
      const response = await this.client.get('/dashboard');
      return response.data;
    } catch (error) {
      console.error('Get dashboard data failed:', error);
      throw error;
    }
  }

  async exportRegistrations(params?: {
    date_from?: string;
    date_to?: string;
    format?: 'csv' | 'excel';
  }): Promise<Blob> {
    try {
      const response = await this.client.get('/reports/export', {
        params,
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      console.error('Export registrations failed:', error);
      throw error;
    }
  }
}

// Singleton instance
export const apiClient = new APIClient();

// Convenience functions
export const API = {
  // Health
  ping: () => apiClient.ping(),
  
  // Auth
  login: (name: string) => apiClient.login(name),
  logout: () => apiClient.logout(),
  getCurrentUser: () => apiClient.getCurrentUser(),
  checkSession: () => apiClient.checkSession(),
  
  // Users
  getUsers: () => apiClient.getUsers(),
  
  // Registrations
  createRegistration: (data: any) => apiClient.createRegistration(data),
  getRegistrations: (params?: any) => apiClient.getRegistrations(params),
  getTodayRegistrations: () => apiClient.getTodayRegistrations(),
  
  // OCR
  processImage: (file: File) => apiClient.processImage(file),
  
  // Dashboard
  getDashboardData: () => apiClient.getDashboardData(),
  exportRegistrations: (params?: any) => apiClient.exportRegistrations(params),
};

export default apiClient;