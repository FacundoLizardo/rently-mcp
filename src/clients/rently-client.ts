// Rently API client with automatic OAuth2 token management
// Extends RestApiClient with client credentials authentication

import { RestApiClient } from './rest-api-client.js';
import type { ResolvedConfig } from '../config/types.js';
import type { ApiRequestOptions, ApiResponse, ClientConfig } from './rest-api-client.js';
import { createScopedLogger } from '../utils/index.js';

/**
 * Token cache structure for storing authentication tokens
 */
interface TokenCache {
  token: string;
  expiresAt: number;
  tokenType: string;
}

/**
 * Rently API client with automatic OAuth2 client credentials authentication
 */
export class RentlyClient extends RestApiClient {
  private tokenCache: TokenCache | null = null;
  private tokenPromise: Promise<string> | null = null;
  private readonly rentlyLogger = createScopedLogger('RentlyClient');
  
  constructor(config: ResolvedConfig) {
    // Use configuration mapping for Rently-specific fields
    const configMapping = {
      baseUrl: 'rentlyBaseUrl',
      clientId: 'rentlyClientId',
      clientSecret: 'rentlyClientSecret'
    };
    
    super(config, configMapping);
    
    this.rentlyLogger.debug('RentlyClient initialized', {
      baseUrl: this.config.baseUrl,
      hasClientId: !!this.clientId,
      hasClientSecret: !!this.clientSecret
    });
  }
  
  /**
   * Override makeRequest to automatically inject Bearer token
   */
  public async makeRequest<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Get fresh token and inject into headers
    const token = await this.getAuthToken();
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    return super.makeRequest<T>(endpoint, { ...options, headers });
  }
  
  /**
   * Get authentication token with caching and concurrent request protection
   */
  private async getAuthToken(): Promise<string> {
    // Check cache validity (with 5-minute buffer)
    if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 300000) {
      this.rentlyLogger.debug('Using cached token', {
        expiresAt: new Date(this.tokenCache.expiresAt).toISOString(),
        remainingMs: this.tokenCache.expiresAt - Date.now()
      });
      return this.tokenCache.token;
    }
    
    // Prevent concurrent token requests
    if (this.tokenPromise) {
      this.rentlyLogger.debug('Waiting for existing token request');
      return await this.tokenPromise;
    }
    
    // Create new token request
    this.tokenPromise = this.requestNewToken();
    
    try {
      const token = await this.tokenPromise;
      return token;
    } finally {
      this.tokenPromise = null;
    }
  }
  
  /**
   * Request new authentication token from Rently API
   */
  private async requestNewToken(): Promise<string> {
    this.rentlyLogger.debug('Requesting new authentication token');
    
    try {
      const authResponse = await fetch('https://taraborellirentacar.rently.com.ar/auth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret
        })
      });
      
      if (!authResponse.ok) {
        const errorText = await authResponse.text();
        this.rentlyLogger.error('Authentication failed', {
          status: authResponse.status,
          statusText: authResponse.statusText,
          response: errorText
        });
        throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
      }
      
      const tokenData = await authResponse.json() as any;
      
      if (!tokenData.access_token) {
        throw new Error('No access token received from authentication endpoint');
      }
      
      // Cache the token
      this.tokenCache = {
        token: tokenData.access_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        tokenType: tokenData.token_type || 'Bearer'
      };
      
      this.rentlyLogger.debug('Token acquired successfully', {
        expiresIn: tokenData.expires_in,
        tokenType: this.tokenCache.tokenType,
        expiresAt: new Date(this.tokenCache.expiresAt).toISOString()
      });
      
      return this.tokenCache.token;
    } catch (error) {
      this.rentlyLogger.error('Token acquisition failed', error);
      throw error;
    }
  }
  
  /**
   * Get client ID from configuration
   */
  get clientId(): string {
    return this.getRentlyConfigValue('clientId') || 
           this.getRentlyConfigValue('rentlyClientId') || 
           'laburen';
  }
  
  /**
   * Get client secret from configuration
   */
  get clientSecret(): string {
    return this.getRentlyConfigValue('clientSecret') || 
           this.getRentlyConfigValue('rentlyClientSecret') || 
           'SGx5SSRMNWc7KypPYlU+YXRhVDEjXl0leTZpK3I/eC1LalF2e19NXipHb2s5cSZLUS90WnVZeXQ1cUZtRi9vPw==';
  }
  
  /**
   * Helper to access configuration values with fallbacks
   */
  private getRentlyConfigValue(key: string): any {
    // Cast to extended config interface to access additional fields
    const extendedConfig = this.config as any;
    return extendedConfig[key] || 
           extendedConfig[key.toLowerCase()] || 
           extendedConfig[key.toUpperCase()];
  }
  
  /**
   * Test Rently API connectivity and authentication
   */
  async testRentlyConnection(): Promise<boolean> {
    try {
      // Test authentication by requesting a token
      await this.getAuthToken();
      
      // Test API connectivity with a simple endpoint
      await this.makeRequest('/api/places', { method: 'GET', timeout: 5000, retries: 0 });
      
      this.rentlyLogger.info('Rently connection test successful');
      return true;
    } catch (error) {
      this.rentlyLogger.warn('Rently connection test failed', { error: (error as Error).message });
      return false;
    }
  }
}