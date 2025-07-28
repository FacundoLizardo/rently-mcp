import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Definimos nuestro MCP agent
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Authless Calculator",
		version: "1.0.0",
	});

	async init() {
		this.server.tool(
			"add",
			{ a: z.number(), b: z.number() },
			async ({ a, b }) => ({
				content: [{ type: "text", text: String(a + b) }],
			})
		);

		this.server.tool(
			"calculate",
			{
				operation: z.enum(["add", "subtract", "multiply", "divide"]),
				a: z.number(),
				b: z.number(),
			},
			async ({ operation, a, b }) => {
				let result: number;
				switch (operation) {
					case "add": result = a + b; break;
					case "subtract": result = a - b; break;
					case "multiply": result = a * b; break;
					case "divide":
						if (b === 0) {
							return {
								content: [
									{ type: "text", text: "Error: Cannot divide by zero" },
								],
							};
						}
						result = a / b;
						break;
				}
				return { content: [{ type: "text", text: String(result) }] };
			}
		);
	}
}

export default {
	async fetch(request: Request, env: Record<string, string>, ctx: ExecutionContext) {
		const url = new URL(request.url);
			// --- Usamos process.env directamente ---
		const client_id = request.headers.get("client_id");
		const client_secret = request.headers.get("client_secret");
		const laburenApiKey = request.headers.get("laburen-api-key");


		if (!client_id || !client_secret || !laburenApiKey) {
			return new Response("Faltan headers/env de autenticación", { status: 401 });
		}

		// --- 2. Extendemos ExecutionContext con props custom ---
		const extendedContext: ExecutionContext & { props?: Record<string, unknown> } = {
			...ctx,
			props: {
				client_id,
				client_secret,
				laburenApiKey,
			},
			waitUntil: ctx.waitUntil.bind(ctx),
			passThroughOnException: ctx.passThroughOnException.bind(ctx),
		};

		console.log("🔍 [fetch] Context props configuradas:", JSON.stringify(extendedContext.props, null, 2));

		// --- 3. Routing ---
		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			console.log("🔄 [fetch] Redirigiendo a SSE");
			return MyMCP.serveSSE("/sse").fetch(request, env, extendedContext);
		}

		if (url.pathname === "/mcp") {
			console.log("🔄 [fetch] Redirigiendo a MCP");
			return MyMCP.serve("/mcp").fetch(request, env, extendedContext);
		}

		console.log("❌ [fetch] Ruta no encontrada:", url.pathname);
		return new Response("Not found", { status: 404 });
	},
};
