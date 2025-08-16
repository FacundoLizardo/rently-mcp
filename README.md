# MCP Starter - Flexible Configuration System

A modular Model Context Protocol (MCP) starter with a hybrid 3-level priority configuration system. Build scalable MCP servers for any API integration (REST, Odoo, Salesforce, custom APIs) with dynamic tool filtering and flexible configuration management.

## 🎯 Features

- **3-Level Priority Configuration** - Headers → Environment Variables → Defaults
- **Flexible Configuration** - Any key-value pairs, no fixed schema required
- **Dynamic Tool Filtering** - Control available tools per request via `to-use` header
- **REST API Client** - Built-in client with auth, retries, and error handling
- **Modular Architecture** - Easy to extend and maintain
- **Production Ready** - Cloudflare Workers optimized

## 🏗️ Configuration System

The starter uses a **3-level priority configuration system** that automatically selects the best configuration available:

### Priority Levels

1. **🔝 Headers (Priority 1)** - Highest priority, per-request configuration
2. **🔄 Environment Variables (Priority 2)** - Medium priority, deployment configuration  
3. **🛡️ Defaults (Priority 3)** - Lowest priority, development fallback

### Configuration Flow

```
Request → Check Headers → Check Environment → Use Defaults → Final Config
   ↓         ↓               ↓                 ↓            ↓
Arrives   Priority 1      Priority 2       Priority 3   Applied to Tools
```

## 🚀 Quick Start

### 1. Installation

```bash
# Clone or download this starter
git clone <your-repo-url>
cd starter-laburen-mcp

# Install dependencies
npm install

# Run type checking
npm run type-check

# Deploy to Cloudflare Workers
npm run deploy
```

### 2. Basic Configuration Examples

#### REST API Integration

**Headers (Priority 1 - Per Request)**
```bash
curl -H "api-url: https://api.example.com" \
     -H "api-token: your-secret-token" \
     -H "to-use: [\"api_get\", \"api_post\"]" \
     https://your-mcp-server.com/mcp
```

**Environment Variables (Priority 2 - Deployment)**
```bash
# In wrangler.toml or Cloudflare Dashboard
API_URL=https://api.example.com
API_TOKEN=your-secret-token
TIMEOUT=30000
TO_USE=["api_get", "api_post", "api_health"]
```

**Defaults (Priority 3 - Development)**
```typescript
// Automatically used if headers and env vars are missing
{
  apiUrl: "http://localhost:3000",
  timeout: 30000,
  retries: 3
}
```

#### Odoo Integration Example

**Headers for Odoo**
```bash
curl -H "odoo-url: https://your-odoo.com" \
     -H "odoo-db: production" \
     -H "odoo-user: api@company.com" \
     -H "odoo-pass: secure-password" \
     https://your-mcp-server.com/mcp
```

**Environment Variables for Odoo**
```bash
ODOO_URL=https://your-odoo.com
ODOO_DB=production
ODOO_USER=api@company.com  
ODOO_PASS=secure-password
```

#### Custom Integration Example

**Headers for Any API**
```bash
curl -H "base-url: https://custom-api.com" \
     -H "auth-key: abc123" \
     -H "version: v2" \
     -H "custom-param: value" \
     https://your-mcp-server.com/mcp
```

## 🔧 Configuration Mapping

The system automatically maps header names to configuration keys:

- `"api-url"` → `apiUrl`
- `"odoo-db"` → `odooDB` 
- `"auth-token"` → `authToken`
- `"custom-param"` → `customParam`

**Environment variables** are mapped from `UPPER_CASE` to `camelCase`:
- `API_URL` → `apiUrl`
- `ODOO_DB` → `odooDB`
- `AUTH_TOKEN` → `authToken`

## 🛠️ Creating API Clients

### Step 1: Create Your Client

```typescript
// src/clients/my-api-client.ts
import { RestApiClient } from './rest-api-client.js';
import type { ResolvedConfig } from '../config/types.js';

export class MyApiClient extends RestApiClient {
  constructor(config: ResolvedConfig) {
    // Map your specific configuration fields
    const configMapping = {
      baseUrl: 'myApiUrl',        // Maps 'my-api-url' header to baseUrl
      authToken: 'myApiToken',    // Maps 'my-api-token' header to authToken
      timeout: 'myTimeout'        // Maps 'my-timeout' header to timeout
    };
    
    super(config, configMapping);
  }

  // Add your specific API methods
  async getUsers() {
    return this.get('/users');
  }

  async createUser(userData: any) {
    return this.post('/users', userData);
  }

  async getOrders(userId: string) {
    return this.get(`/users/${userId}/orders`);
  }
}
```

### Step 2: Add Client to Exports

```typescript
// src/clients/index.ts
export { RestApiClient } from './rest-api-client.js';
export { MyApiClient } from './my-api-client.js';
```

### Step 3: Test Your Client

```typescript
// Create a tool to test your client
const config = { myApiUrl: 'https://api.example.com', myApiToken: 'abc123' };
const client = new MyApiClient(config);
const users = await client.getUsers();
```

## 🔨 Creating MCP Tools

### Step 1: Define Your Tool

```typescript
// src/tools/examples/my-api-tools.ts
import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { MyApiClient } from '../../clients/index.js';
import { ErrorHandler } from '../../utils/index.js';

export const getUsersTool: MCPTool = {
  name: 'get_users',
  description: 'Get list of users from the API',
  schema: z.object({
    page: z.number().optional().describe('Page number for pagination'),
    limit: z.number().optional().describe('Number of users per page')
  }),
  
  handler: async ({ page = 1, limit = 10 }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new MyApiClient(config);
      const response = await client.get('/users', { 
        params: { page, limit } 
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(response.data, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'get_users');
    }
  }
};

export const createUserTool: MCPTool = {
  name: 'create_user',
  description: 'Create a new user',
  schema: z.object({
    name: z.string().describe('User name'),
    email: z.string().email().describe('User email'),
    role: z.string().optional().describe('User role')
  }),
  
  handler: async ({ name, email, role }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new MyApiClient(config);
      const response = await client.createUser({ name, email, role });
      
      return {
        content: [{
          type: 'text',
          text: `User created successfully: ${JSON.stringify(response.data, null, 2)}`
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'create_user');
    }
  }
};

// Export all your tools
export const myApiTools = [
  getUsersTool,
  createUserTool
];
```

### Step 2: Register Your Tools

```typescript
// src/tools/examples/index.ts
export { calculatorTools } from './calculator.js';
export { healthCheckTool } from './health-check.js';
export { apiTools } from './api-tools.js';
export { myApiTools } from './my-api-tools.js'; // Add your tools

// Combine all example tools
import { calculatorTools } from './calculator.js';
import { healthCheckTool } from './health-check.js';
import { apiTools } from './api-tools.js';
import { myApiTools } from './my-api-tools.js';

export const exampleTools = [
  ...calculatorTools,
  healthCheckTool,
  ...apiTools,
  ...myApiTools  // Include your tools
];
```

### Step 3: Use Tool Filtering

Control which tools are available per request using the `to-use` header:

```bash
# Only make specific tools available
curl -H "to-use: [\"get_users\", \"create_user\"]" \
     -H "my-api-url: https://api.example.com" \
     https://your-mcp-server.com/mcp

# Use all tools (default behavior)
curl -H "my-api-url: https://api.example.com" \
     https://your-mcp-server.com/mcp
```

## 📁 Project Structure

```
src/
├── config/                    # Configuration system
│   ├── index.ts              # Configuration barrel
│   ├── types.ts              # Flexible config types
│   ├── priority-resolver.ts  # 3-level priority logic
│   └── defaults.ts           # Default configuration
├── tools/                    # MCP tools
│   ├── index.ts              # Tools barrel
│   ├── registry.ts           # Tool registration & filtering
│   ├── types.ts              # Tool interfaces
│   └── examples/             # Example tools
│       ├── calculator.ts     # Calculator tools
│       ├── health-check.ts   # Health check tool
│       ├── api-tools.ts      # Generic API tools
│       └── my-api-tools.ts   # Your custom tools
├── clients/                  # API clients
│   ├── index.ts              # Client exports
│   ├── rest-api-client.ts    # REST API client
│   └── my-api-client.ts      # Your custom client
├── utils/                    # Utilities
│   ├── index.ts              # Utils barrel
│   ├── logger.ts             # Logging utilities
│   └── errors.ts             # Error handling
├── mcp.ts                    # MCP agent implementation
└── index.ts                  # Clean entry point
```

## 🎯 Tool Filtering System

### `to-use` Header

Control which tools are available for each request:

```typescript
// All tools available (default)
// No header or empty array

// Specific tools only
"to-use": '["get_users", "create_user", "health_check"]'

// Single tool
"to-use": '["get_users"]'
```

### Tool Registry

Tools are automatically registered and filtered:

```typescript
// Tools are registered at startup
registerTools([...exampleTools, ...myApiTools]);

// Filtered per request based on configuration
const availableTools = filterTools(resolvedConfig);
```

## 🔒 Authentication Examples

### Bearer Token

```bash
# Header
curl -H "api-token: your-bearer-token" /mcp

# Environment  
API_TOKEN=your-bearer-token
```

### API Key

```bash
# Header
curl -H "api-key: your-api-key" /mcp

# Environment
API_KEY=your-api-key
```

### Custom Auth

```typescript
// In your client
export class MyApiClient extends RestApiClient {
  constructor(config: ResolvedConfig) {
    const configMapping = {
      baseUrl: 'myApiUrl',
      customAuth: 'myCustomAuth'  // Custom auth field
    };
    super(config, configMapping);
  }

  protected buildHeaders(): Record<string, string> {
    const headers = super.buildHeaders();
    
    // Add custom authentication
    if (this.config.customAuth) {
      headers['X-Custom-Auth'] = this.config.customAuth;
    }
    
    return headers;
  }
}
```

## 🚀 Deployment

### Cloudflare Workers

1. **Configure Environment Variables**
```bash
# In wrangler.toml
[vars]
API_URL = "https://your-api.com"
API_TOKEN = "your-production-token"
TO_USE = "[\"get_users\", \"create_user\"]"
```

2. **Deploy**
```bash
npm run deploy
```

### Environment Variables

```bash
# Production API
API_URL=https://api.production.com
API_TOKEN=prod-token-123

# Staging API  
API_URL=https://api.staging.com
API_TOKEN=staging-token-456

# Tool Configuration
TO_USE=["get_users", "create_user", "health_check"]
TIMEOUT=30000
RETRIES=3
```

## 🧪 Testing

### Test with Headers

```bash
# Test with specific configuration
curl -X POST https://your-mcp-server.com/mcp \
  -H "Content-Type: application/json" \
  -H "api-url: https://jsonplaceholder.typicode.com" \
  -H "to-use: [\"api_get\"]" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "api_get",
      "arguments": {"endpoint": "/users/1"}
    }
  }'
```

### Test Tool Filtering

```bash
# Only calculator tools
curl -H "to-use: [\"add\", \"calculate\"]" /mcp

# Only API tools  
curl -H "to-use: [\"api_get\", \"api_post\"]" /mcp

# All tools (default)
curl /mcp
```

### Health Check

```bash
# Basic health check
curl -X POST /mcp -d '{
  "jsonrpc": "2.0", 
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "health_check",
    "arguments": {"includeConfig": true}
  }
}'
```

## 📚 Examples

### Odoo Integration

```typescript
// Custom Odoo client
export class OdooClient extends RestApiClient {
  constructor(config: ResolvedConfig) {
    const configMapping = {
      baseUrl: 'odooUrl',
      database: 'odooDb', 
      username: 'odooUser',
      password: 'odooPass'
    };
    super(config, configMapping);
  }

  async searchRecords(model: string, domain: any[] = []) {
    return this.post('/web/dataset/search_read', {
      model,
      domain,
      fields: [],
      limit: 100
    });
  }
}

// Odoo tools
export const searchProductsTool: MCPTool = {
  name: 'search_products',
  description: 'Search products in Odoo',
  schema: z.object({
    name: z.string().optional(),
    category: z.string().optional()
  }),
  
  handler: async ({ name, category }, config: ResolvedConfig) => {
    try {
      const client = new OdooClient(config);
      const domain = [];
      if (name) domain.push(['name', 'ilike', name]);
      if (category) domain.push(['categ_id.name', 'ilike', category]);
      
      const response = await client.searchRecords('product.product', domain);
      return {
        content: [{ type: 'text', text: JSON.stringify(response.data, null, 2) }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'search_products');
    }
  }
};
```

### Salesforce Integration

```bash
# Headers
curl -H "sf-instance: https://company.salesforce.com" \
     -H "sf-token: your-session-token" \
     -H "api-version: v58.0" \
     /mcp
```

## 🔧 Customization

### Adding New Configuration Fields

The system accepts any configuration fields. Just use them in your headers or environment variables:

```bash
# Custom fields
curl -H "custom-timeout: 60000" \
     -H "custom-retry-count: 5" \
     -H "custom-base-path: /api/v2" \
     /mcp
```

### Extending the Configuration System

```typescript
// Add validation or transformation
export function processConfig(config: ResolvedConfig): ResolvedConfig {
  // Add custom processing
  if (config.customTimeout) {
    config.timeout = Number(config.customTimeout);
  }
  
  return config;
}
```

## 📖 API Reference

### Configuration Priority Resolution

```typescript
import { resolveConfig } from './config/index.js';

const configContext = resolveConfig(request.headers, env);
console.log(configContext.resolved); // Final configuration
console.log(configContext.sources);  // Which sources were used
```

### Tool Registry

```typescript
import { registerTools, filterTools } from './tools/index.js';

// Register tools
registerTools([myTool1, myTool2]);

// Filter tools for request
const availableTools = filterTools(resolvedConfig);
```

### REST Client

```typescript
import { RestApiClient } from './clients/index.js';

const client = new RestApiClient(config, configMapping);
await client.get('/endpoint');
await client.post('/endpoint', data);
await client.put('/endpoint', data);
await client.delete('/endpoint');
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Add your changes following the existing patterns
4. Test your changes (`npm run type-check`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.