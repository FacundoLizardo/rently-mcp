#!/usr/bin/env node

/**
 * Test script para probar el sistema de prioridades con VARIABLES DE ENTORNO
 * 🔄 Prioridad Media: Variables de Entorno
 */

async function testWithEnv() {
    console.log('🧪 Testing con Variables de Entorno (Prioridad Media)\n');
    
    const serverUrl = 'http://localhost:8787';
    
    // Test 1: Health check
    console.log('1️⃣ Health Check...');
    try {
        const healthResponse = await fetch(`${serverUrl}/health`);
        console.log(`✅ Health: ${healthResponse.status} - ${await healthResponse.text()}`);
    } catch (error) {
        console.log('❌ Health failed:', error.message);
        console.log('💡 Configura las variables de entorno y ejecuta: npm run dev');
        console.log('💡 O usa: BASE_URL=https://taraborellirentacar.rently.com.ar CLIENT_ID=laburen CLIENT_SECRET=ySGx5SSRMNWc7KypPYlU+YXRhVDEjXl0leTZpK3I/eC1LalF2e19NXipHb2s5cSZLUS90WnVZeXQ1cUZtRi9vPw== npm run dev');
        return;
    }

    // Test 2: MCP Initialize (sin Mcp-Session-Id)
    console.log('\n2️⃣ MCP Initialize...');
    
    const sessionId = 'test-session-env-' + Date.now();
    
    const initHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
        // ⚠️ Sin headers X-Rently-* para forzar fallback a ENV
        // ⚠️ Sin Mcp-Session-Id para initialize
    };

    const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'test-env-client', version: '1.0.0' }
        }
    };

    try {
        const response = await fetch(`${serverUrl}/mcp`, {
            method: 'POST',
            headers: initHeaders,
            body: JSON.stringify(initRequest)
        });

        console.log(`✅ MCP Initialize Status: ${response.status}`);
        if (!response.ok) {
            console.log('❌ Initialize Error:', await response.text());
            return;
        }
    } catch (error) {
        console.log('❌ Initialize failed:', error.message);
        return;
    }

    // Test 3: Tools List (con Mcp-Session-Id)
    console.log('\n3️⃣ MCP Tools List...');
    
    const sessionHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId
        // ⚠️ Sin headers X-Rently-* para forzar fallback a ENV
    };
    
    const mcpRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
        params: {}
    };

    try {
        const response = await fetch(`${serverUrl}/mcp`, {
            method: 'POST',
            headers: sessionHeaders,
            body: JSON.stringify(mcpRequest)
        });

        console.log(`✅ MCP Response Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('📋 Available tools:', data.result?.tools?.length || 0);
            console.log('🔧 Tools:', data.result?.tools?.map(t => t.name).join(', ') || 'none');
        } else {
            console.log('❌ MCP Error:', await response.text());
        }
    } catch (error) {
        console.log('❌ MCP Request failed:', error.message);
    }

    // Test 3: Verificar que está usando ENV
    console.log('\n3️⃣ Logs esperados en el servidor:');
    console.log('🔄 [AuthConfig] Usando Variables de Entorno para OAuth2');
    console.log('🔄 [Config] Usando baseUrl de Variables de Entorno');
    console.log('🚀 [Config] Inicializado - Runtime: [valor del ENV BASE_URL]');

    console.log('\n✅ Test con Variables de Entorno completado');
    console.log('💡 Revisa los logs del servidor para confirmar el uso de ENV vars');
}

// Ejecutar test
testWithEnv().catch(console.error);