// Rently API tools exports
// Central export point for all Rently-specific tools

// Location and place management tools
export {
  getPlacesTool
} from './location-tools.js';

// Vehicle availability and search tools
export {
  getAvailabilityTool
} from './availability-tools.js';

// Import for the array export
import { getPlacesTool } from './location-tools.js';
import { getAvailabilityTool } from './availability-tools.js';

// Export all Rently tools as a convenient array
export const rentlyTools = [
  getPlacesTool,
  getAvailabilityTool
];