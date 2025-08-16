// Flexible configuration type definitions for the generic MCP starter platform
// This file defines interfaces for the 3-level priority configuration system
// Completely flexible - supports any integration type (Odoo, Salesforce, REST APIs, etc.)

/**
 * Base flexible configuration interface
 * Can contain any key-value pairs for any integration type
 */
export interface FlexibleConfig {
  [key: string]: any;
}

/**
 * Header-based configuration (Priority Level 1 - Highest)
 * Configuration passed via HTTP headers for per-request customization
 * Only fixed requirement: "to-use" header for tool filtering
 */
export interface HeaderConfig extends FlexibleConfig {
  // Special header for tool filtering (always supported)
  'to-use'?: string[]; // Parsed from "to-use" header (JSON array)
  
  // Any other headers are converted from kebab-case to camelCase
  // Examples:
  // "odoo-url" -> odooUrl
  // "salesforce-token" -> salesforceToken
  // "api-key" -> apiKey
  // "database-name" -> databaseName
}

/**
 * Environment variable configuration (Priority Level 2 - Medium)
 * Configuration from Cloudflare Workers environment variables
 */
export interface EnvConfig extends FlexibleConfig {
  // Any environment variables can be mapped
  // Examples:
  // ODOO_URL -> odooUrl
  // SALESFORCE_TOKEN -> salesforceToken
  // API_KEY -> apiKey
  // DATABASE_NAME -> databaseName
  // DEFAULT_TOOLS -> defaultTools (parsed as JSON array)
}

/**
 * Default configuration (Priority Level 3 - Lowest)
 * Hardcoded fallback values - completely customizable per use case
 */
export interface DefaultConfig extends FlexibleConfig {
  // Can contain any default values
  // Examples for different integrations:
  // { odooUrl: 'http://localhost:8069', odooDb: 'dev' }
  // { salesforceUrl: 'https://test.salesforce.com', apiVersion: 'v58.0' }
  // { apiUrl: 'http://localhost:3000', timeout: 5000 }
}

/**
 * Final resolved configuration after priority resolution
 */
export interface ResolvedConfig extends FlexibleConfig {
  // Contains the final values after merging headers -> env -> defaults
  // Plus special tool filtering field
  availableTools: string[]; // Always present after resolution
}

/**
 * Configuration validation result
 * Flexible validation - no fixed schema requirements
 */
export interface ConfigValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Configuration source tracking for debugging
 * Dynamic - tracks source for any configuration key
 */
export interface ConfigSource {
  [key: string]: 'header' | 'env' | 'default';
}

/**
 * Configuration resolution context containing all levels and metadata
 */
export interface ConfigResolutionContext {
  resolved: ResolvedConfig;
  sources: ConfigSource;
  validation: ConfigValidationResult;
  timestamp: Date;
  // Original inputs for debugging
  raw: {
    headers: HeaderConfig;
    env: EnvConfig;
    defaults: DefaultConfig;
  };
}

/**
 * Tool filtering configuration
 * Used internally for tool availability management
 */
export interface ToolFilterConfig {
  requestedTools?: string[]; // From "to-use" header
  availableTools: string[];  // All registered tools
}