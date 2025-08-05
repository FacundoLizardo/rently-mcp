#!/usr/bin/env node

/**
 * Test script para probar el sistema de prioridades con CONFIGURACIÓN POR DEFECTO
 * 🛡️ Prioridad Baja: Configuración por Defecto
 */

async function testWithDefaults() {
    console.log('🧪 Testing con Configuración por Defecto (Prioridad Baja)\n');
    
    const serverUrl = 'http://localhost:8787';
    
    console.log('⚠️  IMPORTANTE: Para este test, el servidor debe iniciarse SIN variables de entorno');
    console.log('💡 Inicia con: npm run dev:local (sin ENV vars en wrangler)');
    console.log('💡 O temporalmente renombra wrangler.jsonc para evitar ENV vars\n');
    
    // Test 1: Health check
    console.log('1️⃣ Health Check...');
    try {
        const healthResponse = await fetch(`${serverUrl}/health`);
        console.log(`✅ Health: ${healthResponse.status} - ${await healthResponse.text()}`);
    } catch (error) {
        console.log('❌ Health failed:', error.message);
        console.log('💡 Servidor no está corriendo o no está en puerto 8787');
        return;
    }

    // Test 2: MCP Initialize (sin Mcp-Session-Id)
    console.log('\n2️⃣ MCP Initialize...');
    
    const sessionId = 'test-session-default-' + Date.now();
    
    const initHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
        // ⚠️ Sin headers X-Rently-* ni ENV vars para forzar defaults  
        // ⚠️ Sin Mcp-Session-Id para initialize
    };

    const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: { tools: {} },
            clientInfo: { name: 'test-default-client', version: '1.0.0' }
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
        // ⚠️ Sin headers X-Rently-* ni ENV vars para forzar defaults
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

    // Test 3: Verificar que está usando DEFAULTS
    console.log('\n3️⃣ Logs esperados en el servidor:');
    console.log('🛡️ [AuthConfig] Usando configuración OAuth2 por defecto');
    console.log('🛡️ [Config] Usando configuración runtime por defecto');
    console.log('🚀 [Config] Inicializado - Runtime: https://demo.rently.com');

    // Test 4: Intentar auth token (debería usar demo credentials)
    console.log('\n4️⃣ Test de Auth Token con defaults...');
    
    const authRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
            name: 'get_auth_token',
            arguments: {}
        }
    };

    try {
        const response = await fetch(`${serverUrl}/mcp`, {
            method: 'POST',
            headers: {
                ...sessionHeaders,
                'Mcp-Session-Id': 'test-session-auth-' + Date.now()
            },
            body: JSON.stringify(authRequest)
        });

        console.log(`✅ Auth Token Response Status: ${response.status}`);
        
        if (response.ok) {
            const data = await response.json();
            console.log('🔑 Auth resultado:', data.result ? 'Token request enviado' : 'Error en tool');
        }
    } catch (error) {
        console.log('❌ Auth Token failed:', error.message);
    }

    console.log('\n✅ Test con Configuración por Defecto completado');
    console.log('💡 Revisa los logs del servidor para confirmar el uso de defaults');
    console.log('⚠️  El auth token probablemente falle (demo.rently.com no existe)');
}

// Ejecutar test
testWithDefaults().catch(console.error);