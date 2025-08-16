// Tool interface definitions and types
// Defines the structure for MCP tools and their registration

import type { z } from 'zod';
import type { ResolvedConfig } from '../config/types.js';

/**
 * Base interface for all MCP tools
 */
export interface MCPTool {
  /** Unique identifier for the tool */
  name: string;
  
  /** Human-readable description of what the tool does */
  description: string;
  
  /** Zod schema defining the tool's input parameters */
  schema: z.ZodObject<any>;
  
  /** The tool implementation function */
  handler: MCPToolHandler;
  
  /** Optional metadata about the tool */
  metadata?: MCPToolMetadata;
}

/**
 * Tool handler function signature
 */
export type MCPToolHandler = (
  input: any,
  config: ResolvedConfig
) => Promise<MCPToolResult> | MCPToolResult;

/**
 * Result returned by tool handlers
 * Must match the MCP SDK's expected format
 */
export interface MCPToolResult {
  content: Array<{
    type: 'text';
    text: string;
  } | {
    type: 'image';
    data: string;
    mimeType: string;
  } | {
    type: 'resource';
    resource: {
      uri: string;
      text?: string;
      mimeType?: string;
    } | {
      uri: string;
      blob: string;
      mimeType?: string;
    };
  }>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/**
 * Optional metadata for tools
 */
export interface MCPToolMetadata {
  /** Category for grouping tools */
  category?: string;
  
  /** Tags for tool discovery */
  tags?: string[];
  
  /** Version of the tool implementation */
  version?: string;
  
  /** Author information */
  author?: string;
  
  /** Whether this tool requires authentication */
  requiresAuth?: boolean;
  
  /** Whether this tool can be cached */
  cacheable?: boolean;
  
  /** Estimated execution time in milliseconds */
  estimatedDuration?: number;
}

/**
 * Tool registration configuration
 */
export interface ToolRegistration {
  /** The tool definition */
  tool: MCPTool;
  
  /** Whether this tool is enabled by default */
  enabledByDefault?: boolean;
  
  /** Conditions under which this tool should be available */
  conditions?: ToolCondition[];
}

/**
 * Conditions for tool availability
 */
export interface ToolCondition {
  /** Type of condition */
  type: 'config' | 'environment' | 'custom';
  
  /** Field to check (for config conditions) */
  field?: string;
  
  /** Expected value or validation function */
  value?: any | ((value: any) => boolean);
  
  /** Custom validation function */
  validator?: (config: ResolvedConfig) => boolean;
}

/**
 * Tool registry state
 */
export interface ToolRegistry {
  /** All registered tools indexed by name */
  tools: Map<string, ToolRegistration>;
  
  /** Cached filtered tools for performance */
  filteredCache: Map<string, MCPTool[]>;
}

/**
 * Tool filtering options
 */
export interface ToolFilterOptions {
  /** Specific tool names to include */
  include?: string[];
  
  /** Tool names to exclude */
  exclude?: string[];
  
  /** Categories to include */
  categories?: string[];
  
  /** Tags that tools must have */
  requiredTags?: string[];
  
  /** Whether to include tools that require authentication */
  includeAuthRequired?: boolean;
  
  /** Configuration context for condition evaluation */
  config?: ResolvedConfig;
}

/**
 * Tool filtering result
 */
export interface ToolFilterResult {
  /** Tools that passed the filter */
  tools: MCPTool[];
  
  /** Tools that were excluded and why */
  excluded: Array<{
    tool: string;
    reason: string;
  }>;
  
  /** Summary statistics */
  summary: {
    total: number;
    included: number;
    excluded: number;
  };
}