# Rently MCP Server

MCP (Model Context Protocol) server que conecta modelos de IA con la API de Rently para automatizar operaciones de renta de vehículos.

## ¿Qué construimos?

Un servidor MCP que actúa como puente entre modelos de IA (Claude, GPT, etc.) y la plataforma Rently, permitiendo automatizar:
- Cotizaciones de vehículos
- Creación de reservas
- Consulta de disponibilidad
- Gestión de ubicaciones y categorías

## Arquitectura

```
AI Model (Claude/GPT) → MCP Client → Rently MCP Server → Rently API
                                  ↓                    ↓
                         JSON-RPC 2.0              REST API
                                  ↓
                            Cloudflare Workers + Durable Objects
```

- **Runtime**: Cloudflare Workers con Durable Objects para persistencia
- **Protocolo MCP**: JSON-RPC 2.0 para comunicación con modelos de IA
- **API Externa**: REST para comunicación con Rently API
- **Configuración**: Headers HTTP o variables de entorno

## Sistema de Prioridades de Configuración

El servidor implementa **3 niveles de prioridad** para máxima flexibilidad:

### 🔐 **Separación de Responsabilidades**

**AuthConfig** - Solo para OAuth2 (interno):
- `clientId` + `clientSecret` → Solo para obtener tokens
- No se pasa por la aplicación

**RentlyConfig** - Solo para runtime:
- `baseUrl` → Para construir URLs de API
- `token` → Bearer token para autorización

### 🔝 **Prioridad Alta: Headers HTTP**
```http
X-Rently-Base-Url: https://cliente.rently.com.ar
X-Rently-Client-Id: cliente_id        # Para OAuth2 multi-tenant
X-Rently-Client-Secret: cliente_secret # Para OAuth2 multi-tenant
# ℹ️ Se procesan al inicio y NO se pasan a las tools MCP
```

### 🔄 **Prioridad Media: Variables de Entorno**
```json
{
  "vars": {
    "BASE_URL": "https://cliente.rently.com.ar",
    "CLIENT_ID": "cliente_id",     // Solo para OAuth2  
    "CLIENT_SECRET": "cliente_secret" // Solo para OAuth2
  }
}
```

### 🛡️ **Prioridad Baja: Configuración por Defecto**
```typescript
// AuthConfig (interno)
baseUrl: "https://demo.rently.com"
clientId: "demo_client"
clientSecret: "demo_secret"

// RentlyConfig (runtime)  
baseUrl: "https://demo.rently.com"
```

## Tools Disponibles

| Tool | Descripción | Parámetros |
|------|-------------|------------|
| `get_auth_token` | Obtener token de autenticación | - |
| `get_places` | Listar ubicaciones de retiro/devolución | `token`, `format` |
| `get_categories` | Obtener categorías y modelos de vehículos | `token`, `format` |
| `get_availability` | Consultar disponibilidad por fechas | `token`, `from`, `to`, `deliveryPlaceId`, `returnPlaceId` |
| `validate_search_dates` | Validar fechas de búsqueda | `from`, `to` |
| `create_booking` | Crear cotización o reserva | `idVehiculo`, `idReserva`, datos del cliente, fechas, `es_reserva` |

## Correr Localmente

### 1. Instalar dependencias
```bash
npm install
```

### 2. Desarrollo local (sin Cloudflare)
```bash
npm run dev:local
```

### 3. Desarrollo con Cloudflare Workers
```bash
npm run dev        # Usa wrangler.local.jsonc
npm run dev:prod   # Usa wrangler.jsonc
```

### 4. Deploy a producción
```bash
npm run deploy
```

## Configuración por Cliente

Crear archivo `wrangler.local.jsonc` para desarrollo:
```json
{
  "extends": "./wrangler.jsonc",
  "vars": {
    "BASE_URL": "https://tu-cliente.rently.com.ar",
    "CLIENT_ID": "tu_client_id",
    "CLIENT_SECRET": "tu_client_secret"
  }
}
```

Para cada cliente en producción, usar diferentes nombres en `wrangler.jsonc`:
```json
{
  "name": "rently-mcp-cliente1",
  "vars": { /* configuración cliente 1 */ }
}
```

## Agregar Nueva Tool

### 1. Crear el archivo tool
```typescript
// src/tools/nueva-tool.tool.ts
import { z } from 'zod';
import { rentlyClient } from '../rently.client';

export const nuevaTool = {
    name: "nueva_tool",
    description: "Descripción de la funcionalidad",
    parameters: {
        param1: z.string().describe("Descripción del parámetro"),
        param2: z.number().optional().describe("Parámetro opcional")
    },
    handler: async ({ param1, param2 }: { param1: string; param2?: number }) => {
        try {
            const result = await rentlyClient.get(`/api/endpoint/${param1}`);
            return {
                content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }]
            };
        }
    }
};
```

### 2. Exportar en index
```typescript
// src/tools/index.ts
export * from './nueva-tool.tool';
```

### 3. Registrar en MCP
```typescript
// src/mcp.ts - en el método init()
this.registerTool(
    nuevaTool.name,
    nuevaTool.description,
    nuevaTool.parameters,
    nuevaTool.handler
);
```

## Problema Resuelto

Rently maneja **múltiples clientes** (rentadoras) con APIs similares pero configuraciones diferentes. Este MCP server:

- **Elimina integración manual** para cada cliente
- **Automatiza tareas repetitivas** (cotizaciones, reservas, consultas)
- **Permite IA conversacional** para operaciones complejas
- **Reduce errores humanos** en captura de datos
- **Acelera respuesta al cliente** con automatización inteligente

## Uso desde IDEs con MCP

### Cursor
1. Instalar extensión MCP
2. Agregar configuración:
```json
{
  "mcp": {
    "servers": {
      "rently": {
        "command": "node",
        "args": ["dist/index.js"],
        "env": {
          "RENTLY_BASE_URL": "https://cliente.rently.com.ar",
          "RENTLY_CLIENT_ID": "tu_client_id",
          "RENTLY_CLIENT_SECRET": "tu_client_secret"
        }
      }
    }
  }
}
```

### Claude Desktop
```json
{
  "mcpServers": {
    "rently": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"],
      "env": {
        "RENTLY_BASE_URL": "https://cliente.rently.com.ar"
      }
    }
  }
}
```

### Como Servidor Web
```bash
# Correr servidor
npm run dev

# Conectar desde cualquier cliente MCP
curl -X POST http://localhost:8787/mcp \
  -H "X-Rently-Base-Url: https://cliente.rently.com.ar" \
  -H "X-Rently-Client-Id: client_id" \
  -H "X-Rently-Client-Secret: client_secret"
```

## Endpoints del Servidor

- `/mcp` - Protocolo MCP
- `/sse` - Server-Sent Events para tiempo real  
- `/health` - Health check

## Testing del Sistema de Prioridades

### 🧪 Scripts de Testing

```bash
# Test individual por prioridad
npm run test:headers   # 🔝 Test Headers HTTP (Prioridad Alta)
npm run test:env       # 🔄 Test Variables de Entorno (Prioridad Media)  
npm run test:defaults  # 🛡️ Test Configuración por Defecto (Prioridad Baja)

# Test completo
npm run test:all       # Ejecuta todos los tests
```

### 📋 Cómo Testear

**1. Test con Headers HTTP (Prioridad Alta):**
```bash
# Terminal 1: Iniciar servidor
npm run dev

# Terminal 2: Test con headers dinámicos
npm run test:headers
```

**2. Test con Variables de Entorno (Prioridad Media):**
```bash
# Terminal 1: Configurar ENV y servidor
BASE_URL=https://cliente-env.rently.com.ar CLIENT_ID=env_client CLIENT_SECRET=env_secret npm run dev

# Terminal 2: Test sin headers (fuerza ENV)
npm run test:env
```

**3. Test con Configuración por Defecto (Prioridad Baja):**
```bash
# Terminal 1: Servidor sin ENV vars
npm run dev:local

# Terminal 2: Test sin headers ni ENV
npm run test:defaults
```

### 🔍 Logs Esperados

**Headers HTTP:**
```
🔝 [AuthConfig] Usando Headers HTTP para OAuth2
🔝 [Config] Usando baseUrl de Headers HTTP
```

**Variables de Entorno:**
```
🔄 [AuthConfig] Usando Variables de Entorno para OAuth2
🔄 [Config] Usando baseUrl de Variables de Entorno
```

**Configuración por Defecto:**
```
🛡️ [AuthConfig] Usando configuración OAuth2 por defecto
🛡️ [Config] Usando configuración runtime por defecto
```

## Comandos Útiles

```bash
npm run format     # Formatear código
npm run lint:fix   # Corregir linting
npm run type-check # Verificar tipos TypeScript
npm run cf-typegen # Generar tipos de Cloudflare
```