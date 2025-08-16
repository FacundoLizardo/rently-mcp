// Simple REST API client
// Integrates with the flexible configuration system

import type { ResolvedConfig } from '../config/types.js';
import { createScopedLogger } from '../utils/index.js';

/**
 * API request options
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
}

/**
 * API response structure
 */
export interface ApiResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

/**
 * Client configuration after field mapping
 */
export interface ClientConfig {
  baseUrl: string;
  timeout: number;
  retries: number;
  headers: Record<string, string>;
  authToken?: string;
  apiKey?: string;
}

/**
 * Simple REST API client
 */
export class RestApiClient {
  public readonly config: ClientConfig;
  private readonly logger = createScopedLogger('RestApiClient');

  constructor(
    resolvedConfig: ResolvedConfig,
    configMapping?: Record<string, string>
  ) {
    this.config = this.buildConfig(resolvedConfig, configMapping);
    this.logger.debug('RestApiClient initialized', {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      retries: this.config.retries
    });
  }

  /**
   * Build client configuration from resolved config with optional field mapping
   */
  private buildConfig(
    resolvedConfig: ResolvedConfig,
    configMapping?: Record<string, string>
  ): ClientConfig {
    // Default field mapping
    const defaultMapping = {
      baseUrl: 'apiUrl',
      timeout: 'timeout',
      retries: 'retries',
      authToken: 'apiToken',
      apiKey: 'apiKey'
    };

    const mapping = { ...defaultMapping, ...configMapping };
    
    return {
      baseUrl: this.getConfigValue(resolvedConfig, mapping.baseUrl) || 'http://localhost:3000',
      timeout: Number(this.getConfigValue(resolvedConfig, mapping.timeout)) || 30000,
      retries: Number(this.getConfigValue(resolvedConfig, mapping.retries)) || 3,
      authToken: this.getConfigValue(resolvedConfig, mapping.authToken),
      apiKey: this.getConfigValue(resolvedConfig, mapping.apiKey),
      headers: this.buildHeaders(resolvedConfig)
    };
  }

  /**
   * Get configuration value with fallback
   */
  private getConfigValue(config: ResolvedConfig, key: string): any {
    return config[key] || config[key.toLowerCase()] || config[key.toUpperCase()];
  }

  /**
   * Build request headers
   */
  private buildHeaders(config: ResolvedConfig): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'MCP-Client/1.0'
    };

    // Add auth token if available
    if (this.config.authToken) {
      headers['Authorization'] = `Bearer ${this.config.authToken}`;
    }

    // Add API key if available
    if (this.config.apiKey) {
      headers['X-API-Key'] = this.config.apiKey;
    }

    return headers;
  }

  /**
   * Make HTTP request with error handling and retries
   */
  public async makeRequest<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const {
      method = 'GET',
      params = {},
      data,
      headers = {},
      timeout = this.config.timeout,
      retries = this.config.retries
    } = options;

    const url = new URL(endpoint, this.config.baseUrl);
    
    // Add query parameters
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    const requestHeaders = {
      ...this.config.headers,
      ...headers
    };

    const requestOptions: RequestInit = {
      method,
      headers: requestHeaders,
      signal: AbortSignal.timeout(timeout)
    };

    if (data && method !== 'GET') {
      requestOptions.body = JSON.stringify(data);
    }

    let lastError: Error;

    // Retry logic
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        this.logger.debug(`Making ${method} request to ${url.toString()}`, {
          attempt: attempt + 1,
          maxAttempts: retries + 1
        });

        const response = await fetch(url.toString(), requestOptions);
        
        let responseData: any;
        const contentType = response.headers.get('content-type');
        
        if (contentType?.includes('application/json')) {
          responseData = await response.json();
        } else {
          responseData = await response.text();
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries())
        };

      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Request attempt ${attempt + 1} failed`, {
          error: lastError.message,
          willRetry: attempt < retries
        });

        if (attempt < retries) {
          // Exponential backoff
          await new Promise(resolve => setTimeout(resolve, 2 ** attempt * 1000));
        }
      }
    }

    this.logger.error('All request attempts failed', { error: lastError!.message });
    throw lastError!;
  }

  /**
   * GET request
   */
  async get<T = any>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'GET' });
  }

  /**
   * POST request
   */
  async post<T = any>(endpoint: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'POST', data });
  }

  /**
   * PUT request
   */
  async put<T = any>(endpoint: string, data?: any, options?: Omit<ApiRequestOptions, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'PUT', data });
  }

  /**
   * DELETE request
   */
  async delete<T = any>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'data'>): Promise<ApiResponse<T>> {
    return this.makeRequest<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * Test API connectivity
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/health', { method: 'GET', timeout: 5000, retries: 0 });
      return true;
    } catch (error) {
      this.logger.warn('Connection test failed', { error: (error as Error).message });
      return false;
    }
  }
}