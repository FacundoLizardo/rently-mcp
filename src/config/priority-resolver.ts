// Flexible 3-level priority configuration resolution system
// Supports any integration type with dynamic configuration keys

import type { 
  HeaderConfig, 
  EnvConfig, 
  ResolvedConfig,
  ConfigResolutionContext,
  ConfigSource,
  ConfigValidationResult,
  ToolFilterConfig
} from './types.js';
import { getDefaultConfig } from './defaults.js';

/**
 * Extract configuration from HTTP headers
 * Converts kebab-case headers to camelCase configuration
 * Special handling for "to-use" header for tool filtering
 */
export function extractHeaderConfig(headers: Headers): HeaderConfig {
  const config: HeaderConfig = {};
  
  // Iterate through all headers
  for (const [key, value] of headers.entries()) {
    // Convert kebab-case to camelCase
    const camelKey = kebabToCamelCase(key);
    
    // Special handling for tool filtering
    if (key === 'to-use') {
      try {
        config['to-use'] = JSON.parse(value);
      } catch (error) {
        console.warn(`Failed to parse "to-use" header: ${value}`, error);
        config['to-use'] = [];
      }
    } else {
      // Handle other headers - try to parse as JSON, fallback to string
      config[camelKey] = tryParseValue(value);
    }
  }
  
  return config;
}

/**
 * Extract configuration from environment variables
 * Converts UPPER_CASE env vars to camelCase configuration
 */
export function extractEnvConfig(env: any): EnvConfig {
  const config: EnvConfig = {};
  
  if (!env || typeof env !== 'object') {
    return config;
  }
  
  // Iterate through all environment variables
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === 'string') {
      // Convert UPPER_CASE to camelCase
      const camelKey = upperCaseToCamelCase(key);
      
      // Special handling for tool lists
      if (key === 'DEFAULT_TOOLS' || key.endsWith('_TOOLS')) {
        try {
          config[camelKey] = JSON.parse(value);
        } catch (error) {
          console.warn(`Failed to parse env var ${key}: ${value}`, error);
          config[camelKey] = value.split(',').map(s => s.trim());
        }
      } else {
        // Try to parse as JSON, fallback to string
        config[camelKey] = tryParseValue(value);
      }
    }
  }
  
  return config;
}

/**
 * Resolve configuration using 3-level priority system
 * Priority: Headers (1) > Environment (2) > Defaults (3)
 */
export function resolveConfig(headers: Headers, env: any): ConfigResolutionContext {
  const timestamp = new Date();
  
  // Extract configuration from all sources
  const headerConfig = extractHeaderConfig(headers);
  const envConfig = extractEnvConfig(env);
  const defaultConfig = getDefaultConfig();
  
  // Merge configurations with priority
  const resolved: ResolvedConfig = { availableTools: [] };
  const sources: ConfigSource = {};
  
  // Get all possible keys from all sources
  const allKeys = new Set([
    ...Object.keys(defaultConfig),
    ...Object.keys(envConfig),
    ...Object.keys(headerConfig)
  ]);
  
  // Resolve each key according to priority
  for (const key of allKeys) {
    if (Object.hasOwn(headerConfig, key) && headerConfig[key] !== undefined) {
      resolved[key] = headerConfig[key];
      sources[key] = 'header';
    } else if (Object.hasOwn(envConfig, key) && envConfig[key] !== undefined) {
      resolved[key] = envConfig[key];
      sources[key] = 'env';
    } else if (Object.hasOwn(defaultConfig, key) && defaultConfig[key] !== undefined) {
      resolved[key] = defaultConfig[key];
      sources[key] = 'default';
    }
  }
  
  // Handle tool filtering special case
  resolved.availableTools = resolveToolFiltering(headerConfig, envConfig, defaultConfig);
  sources.availableTools = getToolFilteringSource(headerConfig, envConfig, defaultConfig);
  
  // Create validation result (flexible - no fixed schema validation)
  const validation: ConfigValidationResult = {
    isValid: true,
    errors: [],
    warnings: []
  };
  
  // Add warnings for missing common configuration
  if (!resolved.availableTools || resolved.availableTools.length === 0) {
    validation.warnings.push('No tools available - consider setting availableTools or to-use header');
  }
  
  return {
    resolved,
    sources,
    validation,
    timestamp,
    raw: {
      headers: headerConfig,
      env: envConfig,
      defaults: defaultConfig
    }
  };
}

/**
 * Resolve tool filtering from various sources
 */
function resolveToolFiltering(
  headerConfig: HeaderConfig, 
  envConfig: EnvConfig, 
  defaultConfig: any
): string[] {
  // Priority: "to-use" header > env tools > default tools
  if (headerConfig['to-use'] && Array.isArray(headerConfig['to-use'])) {
    return headerConfig['to-use'];
  }
  
  if (envConfig.defaultTools && Array.isArray(envConfig.defaultTools)) {
    return envConfig.defaultTools;
  }
  
  if (envConfig.availableTools && Array.isArray(envConfig.availableTools)) {
    return envConfig.availableTools;
  }
  
  if (defaultConfig.availableTools && Array.isArray(defaultConfig.availableTools)) {
    return defaultConfig.availableTools;
  }
  
  return [];
}

/**
 * Get the source of tool filtering configuration
 */
function getToolFilteringSource(
  headerConfig: HeaderConfig,
  envConfig: EnvConfig, 
  defaultConfig: any
): 'header' | 'env' | 'default' {
  if (headerConfig['to-use'] && Array.isArray(headerConfig['to-use'])) {
    return 'header';
  }
  
  if ((envConfig.defaultTools && Array.isArray(envConfig.defaultTools)) ||
      (envConfig.availableTools && Array.isArray(envConfig.availableTools))) {
    return 'env';
  }
  
  return 'default';
}

/**
 * Get a human-readable summary of the configuration resolution
 */
export function getConfigSummary(context: ConfigResolutionContext): string {
  const { resolved, sources, validation } = context;
  
  let summary = `Configuration resolved at ${context.timestamp.toISOString()}\n`;
  summary += `Status: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}\n`;
  
  if (validation.errors.length > 0) {
    summary += `Errors: ${validation.errors.join(', ')}\n`;
  }
  
  if (validation.warnings.length > 0) {
    summary += `Warnings: ${validation.warnings.join(', ')}\n`;
  }
  
  summary += '\nConfiguration values:\n';
  for (const [key, value] of Object.entries(resolved)) {
    const source = sources[key] || 'unknown';
    const valueStr = key.toLowerCase().includes('pass') ? '[REDACTED]' : 
                    Array.isArray(value) ? `[${value.length} items]` :
                    String(value);
    summary += `  ${key}: ${valueStr} (from ${source})\n`;
  }
  
  return summary;
}

// Helper functions

/**
 * Convert kebab-case to camelCase
 * Example: "client-url" -> "clientUrl"
 */
function kebabToCamelCase(str: string): string {
  return str.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert UPPER_CASE to camelCase
 * Example: "CLIENT_URL" -> "clientUrl"
 */
function upperCaseToCamelCase(str: string): string {
  return str.toLowerCase().replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Try to parse a string value as JSON, fallback to string
 */
function tryParseValue(value: string): any {
  // Don't try to parse if it looks like a simple string
  if (!value.startsWith('{') && !value.startsWith('[') && !value.startsWith('"') && 
      value !== 'true' && value !== 'false' && !value.match(/^\d+(\.\d+)?$/)) {
    return value;
  }
  
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}