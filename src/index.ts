import { RentlyMCP } from "./mcp";

export { RentlyMCP };

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        const url = new URL(request.url);

        // Extract Rently configuration headers
        const baseUrl = request.headers.get("X-Rently-Base-Url");
        const clientId = request.headers.get("X-Rently-Client-Id");
        const clientSecret = request.headers.get("X-Rently-Client-Secret");

        // Create context with configuration
        let context: ExecutionContext;

        // Check required Rently headers
        if (!baseUrl || !clientId || !clientSecret) {
            console.log(
                "⚠️ [fetch] Rently headers not found. Attempting to use Cloudflare Workers environment variables."
            );

            // Try to use Cloudflare Workers environment variables
            const envConfig = {
                baseUrl: (env as any).BASE_URL || "https://demo.rently.com",
                clientId: (env as any).CLIENT_ID || "demo_client",
                clientSecret: (env as any).CLIENT_SECRET || "demo_secret"
            };

            // Inject environment configuration into ExecutionContext props
            context = Object.assign(Object.create(ctx), ctx, {
                props: {
                    ...(ctx as any).props,
                    ...envConfig
                }
            });

            console.log(
                `🔍 [fetch] Environment configuration injected: ${envConfig.baseUrl}`
            );
        } else {
            // Inject real configuration into ExecutionContext props
            context = Object.assign(Object.create(ctx), ctx, {
                props: {
                    ...(ctx as any).props,
                    baseUrl: baseUrl,
                    clientId: clientId,
                    clientSecret: clientSecret
                }
            });

            console.log("🔍 [fetch] Header configuration injected");
        }

        // Only MCP endpoints
        if (url.pathname === "/sse" || url.pathname === "/sse/message") {
            return RentlyMCP.serveSSE("/sse").fetch(request, env, context);
        }

        if (url.pathname === "/mcp") {
            // Get the MCP Durable Object directly and call its fetch method
            const mcpObject = (env as any).MCP_OBJECT as DurableObjectNamespace;
            const id = mcpObject.idFromName("rently-mcp-server");
            const stub = mcpObject.get(id);
            
            // Create a new request with configuration headers for the Durable Object
            const newRequest = new Request(request.url, {
                method: request.method,
                headers: {
                    ...Object.fromEntries(request.headers.entries()),
                    // Pass configuration from context to Durable Object
                    'X-Context-Base-Url': (context as any).props?.baseUrl || '',
                    'X-Context-Client-Id': (context as any).props?.clientId || '',
                    'X-Context-Client-Secret': (context as any).props?.clientSecret || ''
                },
                body: request.body
            });
            
            // Call the Durable Object's fetch method directly
            return await stub.fetch(newRequest);
        }

        // Health check endpoint
        if (url.pathname === "/health") {
            return new Response("OK", { status: 200 });
        }

        return new Response("Not found", { status: 404 });
    }
};
