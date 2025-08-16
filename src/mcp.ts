import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Import the modular configuration system
import { resolveConfig, getConfigSummary } from './config/index.js';
import { registerTools, filterTools, productionTools, getPlacesTool, getAvailabilityTool } from './tools/index.js';
import { createScopedLogger, ErrorHandler } from './utils/index.js';

// Create scoped logger for this module
const logger = createScopedLogger('MCP');

/**
 * Main MCP Agent class with flexible configuration support
 * Handles tool registration and request processing with 3-level priority configuration
 */
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Flexible MCP Starter",
		version: "2.0.0",
	});

	async init() {
		logger.info('Initializing MCP Agent...');
		
		try {
			// Register production tools in the global registry at startup
			registerTools(productionTools);
			logger.info('Registered production tools', { 
				tools: productionTools.map(t => t.name)
			});

			// TODO: Register dynamic tools from the registry with the MCP server
			// await this.setupDynamicTools();

			// Setup backward compatibility tools (original implementation)
			await this.setupBackwardCompatibilityTools();
			
			logger.info('MCP Agent initialization complete');
		} catch (error) {
			logger.error('Failed to initialize MCP Agent', error);
			throw error;
		}
	}

	/**
	 * Setup dynamic tools from the registry with the MCP server
	 * This registers tools from the global registry with the MCP server
	 * TODO: Fix type compatibility issues
	 */
	/* private async setupDynamicTools() {
		logger.debug('Setting up dynamic tools from registry...');

		try {
			// Get a default configuration for tool filtering
			const defaultConfig = resolveConfig(new Headers(), {});
			const availableTools = filterTools(defaultConfig.resolved);

			// Register each tool with the MCP server
			for (const tool of availableTools.tools) {
				logger.debug(`Registering tool: ${tool.name}`);
				
				this.server.tool(
					tool.name,
					tool.description,
					tool.schema.shape,
					async (input: any) => {
						try {
							// Resolve configuration for this specific request
							// In a real request context, headers would be available
							const requestConfig = resolveConfig(new Headers(), {});
							return await tool.handler(input, requestConfig.resolved);
						} catch (error) {
							logger.error(`Error in tool ${tool.name}`, error);
							return ErrorHandler.createToolErrorResponse(error, tool.name);
						}
					}
				);
			}

			logger.info('Dynamic tools setup complete', {
				registered: availableTools.tools.map(t => t.name)
			});
		} catch (error) {
			logger.error('Failed to setup dynamic tools', error);
			throw error;
		}
	} */

	/**
	 * Setup backward compatibility tools from original implementation
	 * These maintain the exact same interface as the original index.ts
	 */
	private async setupBackwardCompatibilityTools() {
		logger.debug('Setting up backward compatibility tools...');

		// Example math tools removed - keeping only production tools

		// Enhanced health check tool using the new flexible configuration system
		this.server.tool(
			"health_check",
			{ 
				includeConfig: z.boolean().optional().default(false),
				testConnectivity: z.boolean().optional().default(false)
			},
			async ({ includeConfig = false, testConnectivity = false }) => {
				try {
					logger.debug('Health check requested', { includeConfig, testConnectivity });
					
					// Extract configuration using the flexible system
					// Note: In tool context, we use default env since headers aren't directly accessible
					const configContext = resolveConfig(new Headers(), {});
					
					const healthInfo: any = {
						status: 'healthy',
						timestamp: new Date().toISOString(),
						system: {
							platform: 'Cloudflare Workers',
							runtime: 'V8',
							version: '2.0.0',
							agent: 'Flexible MCP Starter'
						}
					};

					// Include configuration details if requested
					if (includeConfig) {
						healthInfo.configuration = {
							...configContext.resolved,
							availableToolsCount: configContext.resolved.availableTools.length,
							configSources: configContext.sources,
							// Redact sensitive information
							...Object.fromEntries(
								Object.entries(configContext.resolved).map(([key, value]) => [
									key,
									key.toLowerCase().includes('pass') || 
									key.toLowerCase().includes('secret') || 
									key.toLowerCase().includes('token') 
										? '[REDACTED]' 
										: value
								])
							)
						};
					}

					// Test connectivity if requested
					if (testConnectivity) {
						healthInfo.connectivity = await this.testConnectivity(configContext.resolved);
						if (healthInfo.connectivity.some?.((c: any) => c.error)) {
							healthInfo.status = 'degraded';
						}
					}

					// Get tool filtering information
					const toolFilter = filterTools(configContext.resolved);
					healthInfo.tools = {
						total: toolFilter.summary.total,
						available: toolFilter.summary.included,
						excluded: toolFilter.summary.excluded,
						filteredTools: toolFilter.tools.map(t => t.name),
						excludedTools: toolFilter.excluded
					};

					logger.debug('Health check completed', { status: healthInfo.status });

					return {
						content: [{
							type: "text",
							text: JSON.stringify(healthInfo, null, 2)
						}]
					};
				} catch (error) {
					logger.error('Health check failed', error);
					return ErrorHandler.createToolErrorResponse(error, 'health_check');
				}
			}
		);

		// Rently API tools (manually registered)
		this.server.tool(
			"rently_get_places",
			{
				category: z.enum(['Oficinas', 'Aeropuerto', 'Domicilios']).optional(),
				city: z.string().optional(),
				includeCoordinates: z.boolean().optional().default(false)
			},
			async ({ category, city, includeCoordinates = false }) => {
				try {
					// Resolve configuration for this specific request
					const configContext = resolveConfig(new Headers(), {});
					const result = await getPlacesTool.handler({ category, city, includeCoordinates }, configContext.resolved);
					// Extract the text content and return it directly
					const textContent = result.content.find(c => c.type === 'text');
					return {
						content: [{ type: "text", text: textContent?.type === 'text' ? textContent.text : '{}' }]
					};
				} catch (error) {
					logger.error('Error in rently_get_places tool', error);
					return {
						content: [{
							type: "text",
							text: `Error in rently_get_places: ${ErrorHandler.extractMessage(error)}`
						}]
					};
				}
			}
		);

		// Rently Get Availability Tool
		this.server.tool(
			"rently_get_availability",
			{
				from: z.string().optional(),
				to: z.string().optional(),
				fromPlace: z.number().optional(),
				idVehiculo: z.number().optional(),
				selectedAdditionals: z.array(z.object({
					id: z.number(),
					quantity: z.number().default(1)
				})).optional().default([])
			},
			async ({ from, to, fromPlace, idVehiculo, selectedAdditionals = [] }) => {
				try {
					// Resolve configuration for this specific request
					const configContext = resolveConfig(new Headers(), {});
					const result = await getAvailabilityTool.handler({ 
						from, 
						to, 
						fromPlace, 
						idVehiculo, 
						selectedAdditionals 
					}, configContext.resolved);
					// Extract the text content and return it directly
					const textContent = result.content.find(c => c.type === 'text');
					return {
						content: [{ type: "text", text: textContent?.type === 'text' ? textContent.text : '{}' }]
					};
				} catch (error) {
					logger.error('Error in rently_get_availability tool', error);
					return {
						content: [{
							type: "text",
							text: `Error in rently_get_availability: ${ErrorHandler.extractMessage(error)}`
						}]
					};
				}
			}
		);

		logger.debug('Backward compatibility tools setup complete');
	}

	/**
	 * Test connectivity to configured URLs
	 */
	private async testConnectivity(config: any): Promise<any> {
		// Find URL fields in configuration (flexible approach)
		const urlFields = Object.entries(config)
			.filter(([key, value]) => 
				typeof value === 'string' && 
				key.toLowerCase().includes('url') &&
				(value.startsWith('http://') || value.startsWith('https://'))
			);
		
		if (urlFields.length === 0) {
			return {
				status: 'no_urls_found',
				message: 'No URL fields found in configuration for connectivity testing'
			};
		}

		const results = [];
		for (const [key, url] of urlFields) {
			try {
				// Basic URL validation
				new URL(url as string);
				results.push({
					field: key,
					url: url,
					status: 'url_valid',
					message: `${key} is properly formatted`
				});
			} catch (error) {
				results.push({
					field: key,
					url: url,
					status: 'url_invalid',
					message: `Invalid ${key}: ${ErrorHandler.extractMessage(error)}`,
					error: true
				});
			}
		}

		return results;
	}
}

/**
 * Helper function to log configuration for a request
 * Demonstrates the 3-level priority configuration system in action
 */
export function logRequestConfiguration(headers: Headers, env: any) {
	const logger = createScopedLogger('Config');
	
	try {
		const configContext = resolveConfig(headers, env);
		
		logger.info('=== Request Configuration ===');
		logger.info('Configuration summary', getConfigSummary(configContext));
		
		// Log tool filtering
		const toolFilter = filterTools(configContext.resolved);
		logger.info('Tool filtering', {
			available: `${toolFilter.summary.included}/${toolFilter.summary.total}`,
			tools: toolFilter.tools.map(t => t.name),
			excluded: toolFilter.excluded
		});
		
		logger.info('=== End Configuration ===');
	} catch (error) {
		logger.error('Error logging configuration', error);
	}
}