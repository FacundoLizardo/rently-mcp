// Flexible default configuration values (Priority Level 3 - Lowest)
// These are the hardcoded fallback values used when no headers or env vars are provided
// Completely customizable per integration type

import type { DefaultConfig } from './types.js';

/**
 * Default configuration for generic MCP starter
 * These values are examples - customize for your specific integration
 * 
 * Examples for different integrations:
 * - Odoo: { odooUrl: 'http://localhost:8069', odooDb: 'dev', odooUser: 'admin' }
 * - Salesforce: { salesforceUrl: 'https://test.salesforce.com', apiVersion: 'v58.0' }
 * - REST API: { apiUrl: 'http://localhost:3000', timeout: 5000, retries: 3 }
 */
export const defaultConfig: DefaultConfig = {
  // Example default values - customize these for your integration
  clientUrl: 'http://localhost:8000',
  clientDb: 'development',
  clientUser: 'dev_user',
  
  // Tools configuration
  availableTools: [
    'add',
    'calculate', 
    'health_check'
  ],
  
  // Additional flexible defaults
  timeout: 30000,
  retries: 3,
  debug: false
};

/**
 * Get the default configuration
 * This function allows for future customization of defaults based on environment
 * or other runtime factors
 */
export function getDefaultConfig(): DefaultConfig {
  return { ...defaultConfig };
}

/**
 * Check if a value is using the default configuration
 * Useful for debugging and understanding configuration sources
 */
export function isDefaultValue(key: string, value: any): boolean {
  return defaultConfig[key] === value;
}

/**
 * Get all default configuration keys
 * Useful for understanding what configuration options are available
 */
export function getDefaultConfigKeys(): string[] {
  return Object.keys(defaultConfig);
}

/**
 * Merge user defaults with built-in defaults
 * Allows runtime customization of default values
 */
export function createCustomDefaults(customDefaults: Partial<DefaultConfig>): DefaultConfig {
  return { ...defaultConfig, ...customDefaults };
}