// Import the modular MCP agent and configuration system
import { MyMCP, logRequestConfiguration } from './mcp.js';

// Export the MCP agent for external use
export { MyMCP };

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		// Log configuration for debugging (this demonstrates the new system working)
		logRequestConfiguration(request.headers, env);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};