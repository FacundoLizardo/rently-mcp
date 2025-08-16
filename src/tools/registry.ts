// Tool registration and filtering system
// Manages the registry of available tools and handles dynamic filtering

import type { 
  MCPTool, 
  ToolRegistration, 
  ToolRegistry, 
  ToolFilterOptions,
  ToolFilterResult,
  ToolCondition
} from './types.js';
import type { ResolvedConfig } from '../config/types.js';

/**
 * Global tool registry instance
 */
const toolRegistry: ToolRegistry = {
  tools: new Map(),
  filteredCache: new Map()
};

/**
 * Register a tool in the global registry
 */
export function registerTool(
  tool: MCPTool, 
  options: Omit<ToolRegistration, 'tool'> = {}
): void {
  const registration: ToolRegistration = {
    tool,
    enabledByDefault: options.enabledByDefault ?? true,
    conditions: options.conditions ?? []
  };
  
  toolRegistry.tools.set(tool.name, registration);
  
  // Clear filtered cache since registry changed
  toolRegistry.filteredCache.clear();
  
  console.log(`Registered tool: ${tool.name}`);
}

/**
 * Register multiple tools at once
 */
export function registerTools(tools: MCPTool[]): void {
  tools.forEach(tool => registerTool(tool));
}

/**
 * Get all registered tools
 */
export function getAllTools(): MCPTool[] {
  return Array.from(toolRegistry.tools.values()).map(reg => reg.tool);
}

/**
 * Get a specific tool by name
 */
export function getTool(name: string): MCPTool | undefined {
  const registration = toolRegistry.tools.get(name);
  return registration?.tool;
}

/**
 * Check if a tool is registered
 */
export function isToolRegistered(name: string): boolean {
  return toolRegistry.tools.has(name);
}

/**
 * Filter tools based on configuration and options
 */
export function filterTools(
  config: ResolvedConfig,
  options: ToolFilterOptions = {}
): ToolFilterResult {
  // Create cache key from config and options
  const cacheKey = createFilterCacheKey(config, options);
  
  // Check cache first
  const cached = toolRegistry.filteredCache.get(cacheKey);
  if (cached) {
    return createFilterResult(cached, toolRegistry);
  }
  
  const allRegistrations = Array.from(toolRegistry.tools.values());
  const includedTools: MCPTool[] = [];
  const excluded: Array<{ tool: string; reason: string }> = [];
  
  for (const registration of allRegistrations) {
    const tool = registration.tool;
    const includeReason = shouldIncludeTool(tool, registration, config, options);
    
    if (includeReason === true) {
      includedTools.push(tool);
    } else {
      excluded.push({
        tool: tool.name,
        reason: includeReason as string
      });
    }
  }
  
  // Apply "to-use" filtering if specified in config
  let finalTools = includedTools;
  if (config.availableTools && config.availableTools.length > 0) {
    const requestedTools = new Set(config.availableTools);
    finalTools = includedTools.filter(tool => requestedTools.has(tool.name));
    
    // Add excluded tools that weren't in the requested list
    includedTools.forEach(tool => {
      if (!requestedTools.has(tool.name)) {
        excluded.push({
          tool: tool.name,
          reason: 'Not in requested tools list'
        });
      }
    });
  }
  
  // Cache the result
  toolRegistry.filteredCache.set(cacheKey, finalTools);
  
  return {
    tools: finalTools,
    excluded,
    summary: {
      total: allRegistrations.length,
      included: finalTools.length,
      excluded: excluded.length
    }
  };
}

/**
 * Check if a tool should be included based on conditions and filters
 */
function shouldIncludeTool(
  tool: MCPTool,
  registration: ToolRegistration,
  config: ResolvedConfig,
  options: ToolFilterOptions
): true | string {
  // Check if tool is enabled by default
  if (!registration.enabledByDefault) {
    return 'Tool is disabled by default';
  }
  
  // Check explicit include/exclude lists
  if (options.include && !options.include.includes(tool.name)) {
    return 'Not in include list';
  }
  
  if (options.exclude && options.exclude.includes(tool.name)) {
    return 'In exclude list';
  }
  
  // Check category filter
  if (options.categories) {
    const toolCategory = tool.metadata?.category;
    if (!toolCategory || !options.categories.includes(toolCategory)) {
      return 'Category not in allowed list';
    }
  }
  
  // Check required tags
  if (options.requiredTags && options.requiredTags.length > 0) {
    const toolTags = tool.metadata?.tags || [];
    const hasAllRequiredTags = options.requiredTags.every(tag => 
      toolTags.includes(tag)
    );
    if (!hasAllRequiredTags) {
      return 'Missing required tags';
    }
  }
  
  // Check authentication requirements
  if (tool.metadata?.requiresAuth && options.includeAuthRequired === false) {
    return 'Tool requires authentication but auth tools are excluded';
  }
  
  // Check registration conditions
  for (const condition of registration.conditions || []) {
    const conditionMet = evaluateCondition(condition, config);
    if (!conditionMet) {
      return `Condition not met: ${condition.type}`;
    }
  }
  
  return true;
}

/**
 * Evaluate a tool condition against the current configuration
 */
function evaluateCondition(condition: ToolCondition, config: ResolvedConfig): boolean {
  switch (condition.type) {
    case 'config': {
      if (!condition.field) return false;
      const configValue = (config as any)[condition.field];
      if (typeof condition.value === 'function') {
        return condition.value(configValue);
      }
      return configValue === condition.value;
    }
      
    case 'environment':
      // Could check environment-specific conditions here
      return true;
      
    case 'custom':
      if (condition.validator) {
        return condition.validator(config);
      }
      return true;
      
    default:
      return false;
  }
}

/**
 * Create a cache key for filter results
 * Uses flexible configuration approach - only uses availableTools and options
 */
function createFilterCacheKey(config: ResolvedConfig, options: ToolFilterOptions): string {
  const keyParts = [
    config.availableTools.join(','),
    options.include?.join(',') || '',
    options.exclude?.join(',') || '',
    options.categories?.join(',') || '',
    options.requiredTags?.join(',') || '',
    options.includeAuthRequired?.toString() || 'undefined'
  ];
  
  return keyParts.join('|');
}

/**
 * Create a filter result object
 */
function createFilterResult(tools: MCPTool[], registry: ToolRegistry): ToolFilterResult {
  const total = registry.tools.size;
  const included = tools.length;
  const excluded = total - included;
  
  return {
    tools,
    excluded: [], // Would need to recalculate for cached results
    summary: {
      total,
      included,
      excluded
    }
  };
}

/**
 * Clear the tool registry (useful for testing)
 */
export function clearRegistry(): void {
  toolRegistry.tools.clear();
  toolRegistry.filteredCache.clear();
}

/**
 * Get registry statistics
 */
export function getRegistryStats() {
  return {
    totalTools: toolRegistry.tools.size,
    cacheEntries: toolRegistry.filteredCache.size,
    tools: Array.from(toolRegistry.tools.keys())
  };
}