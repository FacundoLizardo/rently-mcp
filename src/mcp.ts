import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { RentlyConfig, getRentlyConfig } from "./config";
import {
    getAuthTokenTool,
    getPlacesTool,
    getCategoriesTool,
    getAvailabilityTool,
    validateSearchDatesTool,
    createBookingTool
} from "./tools";

/**
 * RentlyMCP Agent class
 * Handles MCP server initialization and tool registration
 */
export class RentlyMCP extends McpAgent {
    protected config!: RentlyConfig;
    private initialized: boolean = false;

    server = new McpServer({
        name: "Rently MCP Server",
        version: "1.0.0",
        description: "Rently Model Context Protocol Server"
    });

    constructor(state: DurableObjectState, env: any) {
        super(state, env);
        console.log(`[RentlyMCP] Constructor called`);
    }

    // Method helper to get configuration from request headers
    private getConfigFromRequest(request: Request): RentlyConfig {
        const baseUrl = request.headers.get('X-Context-Base-Url') || 
                       request.headers.get('X-Rently-Base-Url') || 
                       getRentlyConfig().baseUrl;
        
        console.log('🔍 [RentlyMCP] Configuration from request:', { baseUrl });

        return { baseUrl };
    }

    /**
     * Get the current configuration
     */
    public getConfig(): RentlyConfig {
        return this.config;
    }


    /**
     * Initialize the MCP server and register all tools
     */
    async init() {
        console.log('🔧 [RentlyMCP] init() called');

        // Only initialize once per Durable Object instance
        if (this.initialized) {
            console.log('✅ [RentlyMCP] Already initialized, skipping tool registration');
            return;
        }

        // Configuration will be set when handling requests
        console.log('✅ [RentlyMCP] Initializing for the first time');

        // Register all available tools (only once)
        this.registerTool(
            getAuthTokenTool.name,
            getAuthTokenTool.description,
            getAuthTokenTool.parameters,
            getAuthTokenTool.handler
        );

        this.registerTool(
            getPlacesTool.name,
            getPlacesTool.description,
            getPlacesTool.parameters,
            getPlacesTool.handler
        );

        this.registerTool(
            getCategoriesTool.name,
            getCategoriesTool.description,
            getCategoriesTool.parameters,
            getCategoriesTool.handler
        );

        this.registerTool(
            getAvailabilityTool.name,
            getAvailabilityTool.description,
            getAvailabilityTool.parameters,
            getAvailabilityTool.handler
        );

        this.registerTool(
            validateSearchDatesTool.name,
            validateSearchDatesTool.description,
            validateSearchDatesTool.parameters,
            validateSearchDatesTool.handler
        );

        this.registerTool(
            createBookingTool.name,
            createBookingTool.description,
            createBookingTool.parameters,
            createBookingTool.handler
        );

        this.initialized = true;
        console.log("🔧 [RentlyMCP] Tools registered successfully");
    }

    /**
     * Register a new tool with the server
     */
    public registerTool(
        name: string,
        description: string,
        parameters: Record<string, any>,
        handler: (params: any, extra: any) => Promise<any>
    ) {
        this.server.tool(name, description, parameters, handler);
    }

    /**
     * Handle MCP JSON-RPC requests
     */
    async fetch(request: Request): Promise<Response> {
        console.log(`🔄 [RentlyMCP] fetch() called: ${request.method} ${request.url}`);
        
        // Handle CORS preflight
        if (request.method === "OPTIONS") {
            return new Response(null, {
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "POST, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Max-Age": "86400"
                }
            });
        }

        if (request.method !== "POST") {
            return new Response("Method not allowed", { status: 405 });
        }

        try {
            // Parse JSON-RPC request
            const body = await request.text();
            console.log(`📝 [RentlyMCP] Request body: ${body}`);
            
            const jsonRpcRequest = JSON.parse(body);
            console.log(`📋 [RentlyMCP] Parsed JSON-RPC:`, jsonRpcRequest);

            let result;

            // Get configuration from request for this session
            this.config = this.getConfigFromRequest(request);

            // Handle MCP protocol methods
            if (jsonRpcRequest.method === "initialize") {
                // Initialize the server first
                await this.init();
                
                result = {
                    protocolVersion: "2024-11-05",
                    capabilities: { tools: {} },
                    serverInfo: {
                        name: "Rently MCP Server",
                        version: "1.0.0"
                    }
                };
            } else if (jsonRpcRequest.method === "tools/list") {
                result = {
                    tools: [
                        { name: "get_auth_token", description: "Get OAuth2 authentication token", inputSchema: getAuthTokenTool.parameters },
                        { name: "get_places", description: "Get available pickup/return places", inputSchema: getPlacesTool.parameters },
                        { name: "get_categories", description: "Get vehicle categories", inputSchema: getCategoriesTool.parameters },
                        { name: "get_availability", description: "Check vehicle availability", inputSchema: getAvailabilityTool.parameters },
                        { name: "validate_search_dates", description: "Validate search dates", inputSchema: validateSearchDatesTool.parameters },
                        { name: "create_booking", description: "Create a new booking", inputSchema: createBookingTool.parameters }
                    ]
                };
            } else if (jsonRpcRequest.method === "tools/call") {
                // Execute the requested tool
                const toolName = jsonRpcRequest.params.name;
                const toolArgs = jsonRpcRequest.params.arguments || {};
                
                console.log(`🔧 [RentlyMCP] Calling tool: ${toolName} with args:`, toolArgs);
                
                // Call the appropriate tool handler
                let toolResult;
                switch (toolName) {
                    case "get_auth_token":
                        toolResult = await getAuthTokenTool.handler();
                        break;
                    case "get_places":
                        toolResult = await getPlacesTool.handler(toolArgs);
                        break;
                    case "get_categories":
                        toolResult = await getCategoriesTool.handler(toolArgs);
                        break;
                    case "get_availability":
                        toolResult = await getAvailabilityTool.handler(toolArgs);
                        break;
                    case "validate_search_dates":
                        toolResult = await validateSearchDatesTool.handler(toolArgs);
                        break;
                    case "create_booking":
                        toolResult = await createBookingTool.handler(toolArgs);
                        break;
                    default:
                        throw new Error(`Unknown tool: ${toolName}`);
                }
                
                result = toolResult;
            } else {
                throw new Error(`Unknown method: ${jsonRpcRequest.method}`);
            }

            const response = {
                jsonrpc: "2.0",
                id: jsonRpcRequest.id,
                result: result
            };

            console.log(`✅ [RentlyMCP] Response:`, response);

            return new Response(JSON.stringify(response), {
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });

        } catch (error) {
            console.error(`❌ [RentlyMCP] Error processing request:`, error);
            
            const errorResponse = {
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: error instanceof Error ? error.message : "Internal error"
                },
                id: null
            };

            return new Response(JSON.stringify(errorResponse), {
                status: 500,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                }
            });
        }
    }

    /**
     * Static method to serve SSE endpoints
     */
    static serveSSE(path: string, options?: { binding?: string; corsOptions?: any }) {
        return McpAgent.serveSSE(path, { binding: "MCP_OBJECT", ...options });
    }

    /**
     * Static method to serve MCP endpoints
     */
    static serve(path: string, options?: { binding?: string; corsOptions?: any }) {
        return McpAgent.serve(path, { binding: "MCP_OBJECT", ...options });
    }
}
