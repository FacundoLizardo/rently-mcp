// Tools barrel export
// Central export point for all tool-related functionality

// Types
export type {
  MCPTool,
  MCPToolHandler,
  MCPToolResult,
  MCPToolMetadata,
  ToolRegistration,
  ToolRegistry,
  ToolFilterOptions,
  ToolFilterResult,
  ToolCondition
} from './types.js';

// Registry functions
export {
  registerTool,
  registerTools,
  getAllTools,
  getTool,
  isToolRegistered,
  filterTools,
  clearRegistry,
  getRegistryStats
} from './registry.js';

// Rently API tools
export {
  getPlacesTool,
  getAvailabilityTool,
  rentlyTools
} from './rently/index.js';

// Import for creating production tools array
import { rentlyTools } from './rently/index.js';

// Production tools array (health check + rently tools)
export const productionTools = [ ...rentlyTools];