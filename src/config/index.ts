// Configuration management barrel export
// Central export point for all configuration-related functionality
// Flexible configuration system without fixed schema validation

// Types
export type {
  FlexibleConfig,
  HeaderConfig,
  EnvConfig,
  DefaultConfig,
  ResolvedConfig,
  ConfigValidationResult,
  ConfigSource,
  ConfigResolutionContext,
  ToolFilterConfig
} from './types.js';

// Default configuration
export { 
  defaultConfig, 
  getDefaultConfig, 
  isDefaultValue,
  getDefaultConfigKeys,
  createCustomDefaults
} from './defaults.js';

// Priority resolution system
export {
  extractHeaderConfig,
  extractEnvConfig,
  resolveConfig,
  getConfigSummary
} from './priority-resolver.js';