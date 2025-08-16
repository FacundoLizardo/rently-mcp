// Error handling utilities for the MCP starter
// Provides consistent error handling and reporting

/**
 * Base error class for MCP-related errors
 */
export class MCPError extends Error {
  public readonly code: string;
  public readonly details?: any;
  public readonly timestamp: Date;

  constructor(message: string, code: string = 'MCP_ERROR', details?: any) {
    super(message);
    this.name = 'MCPError';
    this.code = code;
    this.details = details;
    this.timestamp = new Date();
  }

  /**
   * Convert error to a plain object for logging/serialization
   */
  toObject() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      details: this.details,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack
    };
  }
}

/**
 * Configuration-related errors
 */
export class ConfigurationError extends MCPError {
  constructor(message: string, details?: any) {
    super(message, 'CONFIG_ERROR', details);
    this.name = 'ConfigurationError';
  }
}

/**
 * Tool-related errors
 */
export class ToolError extends MCPError {
  public readonly toolName?: string;

  constructor(message: string, toolName?: string, details?: any) {
    super(message, 'TOOL_ERROR', details);
    this.name = 'ToolError';
    this.toolName = toolName;
  }
}

/**
 * Connection/network-related errors
 */
export class ConnectionError extends MCPError {
  public readonly url?: string;
  public readonly statusCode?: number;

  constructor(message: string, url?: string, statusCode?: number, details?: any) {
    super(message, 'CONNECTION_ERROR', details);
    this.name = 'ConnectionError';
    this.url = url;
    this.statusCode = statusCode;
  }
}

/**
 * Validation errors
 */
export class ValidationError extends MCPError {
  public readonly field?: string;
  public readonly value?: any;

  constructor(message: string, field?: string, value?: any, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
    this.field = field;
    this.value = value;
  }
}

/**
 * Error handling utilities
 */
export class ErrorHandler {
  /**
   * Safely extract error message from unknown error type
   */
  static extractMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    if (typeof error === 'string') {
      return error;
    }
    if (error && typeof error === 'object' && 'message' in error) {
      return String((error as any).message);
    }
    return 'Unknown error occurred';
  }

  /**
   * Safely extract error stack from unknown error type
   */
  static extractStack(error: unknown): string | undefined {
    if (error instanceof Error) {
      return error.stack;
    }
    return undefined;
  }

  /**
   * Convert any error to a standardized error object
   */
  static normalize(error: unknown): MCPError {
    if (error instanceof MCPError) {
      return error;
    }
    
    if (error instanceof Error) {
      return new MCPError(error.message, 'UNKNOWN_ERROR', {
        originalName: error.name,
        stack: error.stack
      });
    }

    return new MCPError(
      ErrorHandler.extractMessage(error),
      'UNKNOWN_ERROR',
      { originalError: error }
    );
  }

  /**
   * Create a safe error response for tools
   */
  static createToolErrorResponse(error: unknown, toolName?: string) {
    const normalizedError = ErrorHandler.normalize(error);
    
    return {
      content: [{
        type: 'text' as const,
        text: `Error in ${toolName || 'tool'}: ${normalizedError.message}`
      }],
      isError: true,
      _meta: {
        error: normalizedError.toObject()
      }
    };
  }

  /**
   * Log error with context
   */
  static logError(error: unknown, context?: string) {
    const normalizedError = ErrorHandler.normalize(error);
    const logMessage = context 
      ? `${context}: ${normalizedError.message}`
      : normalizedError.message;
    
    console.error(logMessage, normalizedError.toObject());
  }
}

/**
 * Async error boundary utility
 */
export async function withErrorBoundary<T>(
  operation: () => Promise<T>,
  context?: string
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    ErrorHandler.logError(error, context);
    throw ErrorHandler.normalize(error);
  }
}

/**
 * Sync error boundary utility
 */
export function withErrorBoundarySync<T>(
  operation: () => T,
  context?: string
): T {
  try {
    return operation();
  } catch (error) {
    ErrorHandler.logError(error, context);
    throw ErrorHandler.normalize(error);
  }
}