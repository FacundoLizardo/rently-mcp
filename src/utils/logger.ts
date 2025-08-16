// Flexible logging utilities for the MCP starter
// Provides consistent logging across all modules

/**
 * Log levels for filtering output
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3
}

/**
 * Logger configuration
 */
export interface LoggerConfig {
  level: LogLevel;
  prefix?: string;
  timestamp?: boolean;
  colors?: boolean;
}

/**
 * Default logger configuration
 */
const defaultConfig: LoggerConfig = {
  level: LogLevel.INFO,
  timestamp: true,
  colors: false // Cloudflare Workers doesn't support colors well
};

/**
 * Current logger configuration
 */
let currentConfig: LoggerConfig = { ...defaultConfig };

/**
 * Configure the logger
 */
export function configureLogger(config: Partial<LoggerConfig>): void {
  currentConfig = { ...currentConfig, ...config };
}

/**
 * Create a formatted log message
 */
function formatMessage(level: string, message: string, data?: any): string {
  const parts: string[] = [];
  
  if (currentConfig.timestamp) {
    parts.push(new Date().toISOString());
  }
  
  if (currentConfig.prefix) {
    parts.push(`[${currentConfig.prefix}]`);
  }
  
  parts.push(`[${level}]`);
  parts.push(message);
  
  let formatted = parts.join(' ');
  
  if (data !== undefined) {
    if (typeof data === 'object') {
      formatted += ' ' + JSON.stringify(data, null, 2);
    } else {
      formatted += ' ' + String(data);
    }
  }
  
  return formatted;
}

/**
 * Log an error message
 */
export function logError(message: string, data?: any): void {
  if (currentConfig.level >= LogLevel.ERROR) {
    console.error(formatMessage('ERROR', message, data));
  }
}

/**
 * Log a warning message
 */
export function logWarn(message: string, data?: any): void {
  if (currentConfig.level >= LogLevel.WARN) {
    console.warn(formatMessage('WARN', message, data));
  }
}

/**
 * Log an info message
 */
export function logInfo(message: string, data?: any): void {
  if (currentConfig.level >= LogLevel.INFO) {
    console.log(formatMessage('INFO', message, data));
  }
}

/**
 * Log a debug message
 */
export function logDebug(message: string, data?: any): void {
  if (currentConfig.level >= LogLevel.DEBUG) {
    console.log(formatMessage('DEBUG', message, data));
  }
}

/**
 * Create a scoped logger with a specific prefix
 */
export function createScopedLogger(prefix: string) {
  return {
    error: (message: string, data?: any) => logError(`[${prefix}] ${message}`, data),
    warn: (message: string, data?: any) => logWarn(`[${prefix}] ${message}`, data),
    info: (message: string, data?: any) => logInfo(`[${prefix}] ${message}`, data),
    debug: (message: string, data?: any) => logDebug(`[${prefix}] ${message}`, data),
  };
}

/**
 * Get current logger configuration
 */
export function getLoggerConfig(): LoggerConfig {
  return { ...currentConfig };
}