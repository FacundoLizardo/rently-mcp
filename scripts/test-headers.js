#!/usr/bin/env node

/**
 * Test script para probar el sistema de prioridades con HEADERS HTTP
 * 🔝 Prioridad Alta: Headers HTTP
 */

async function testWithHeaders() {
    console.log('🧪 Testing con Headers HTTP (Prioridad Alta)\n');
    
    const serverUrl = 'http://localhost:8787';
    
    // Test 1: Health check
    console.log('1️⃣ Health Check...');
    try {
        const healthResponse = await fetch(`${serverUrl}/health`);
        console.log(`✅ Health: ${healthResponse.status} - ${await healthResponse.text()}`);
    } catch (error) {
        console.log('❌ Health failed:', error.message);
        console.log('💡 Asegúrate de que el servidor esté corriendo: npm run dev');
        return;
    }

    // Test 2: MCP Initialize (SIN Mcp-Session-Id)
    console.log('\n2️⃣ MCP Initialize (handshake)...');
    
    const sessionId = 'test-session-headers-' + Date.now();
    
    // Headers para INITIALIZE (sin Mcp-Session-Id)
    const initHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'X-Rently-Base-Url': 'https://taraborellirentacar.rently.com.ar',
        'X-Rently-Client-Id': 'laburen',
        'X-Rently-Client-Secret': 'ySGx5SSRMNWc7KypPYlU+YXRhVDEjXl0leTZpK3I/eC1LalF2e19NXipHb2s5cSZLUS90WnVZeXQ1cUZtRi9vPw=='
        // ⚠️ NO incluir Mcp-Session-Id en initialize
    };

    const initRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
            protocolVersion: '2024-11-05',
            capabilities: {
                tools: {}
            },
            clientInfo: {
                name: 'test-client',
                version: '1.0.0'
            }
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
            console.log('❌ MCP Initialize Error:', await response.text());
            return;
        }
        
        const initData = await response.json();
        console.log('📋 Initialize result:', initData.result ? 'OK' : 'Failed');
    } catch (error) {
        console.log('❌ MCP Initialize failed:', error.message);
        return;
    }

    // Test 3: MCP Tools List (CON Mcp-Session-Id)
    console.log('\n3️⃣ MCP Tools List...');
    
    // Headers para requests POST-INITIALIZE (con Mcp-Session-Id)
    const sessionHeaders = {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
        'X-Rently-Base-Url': 'https://cliente-test.rently.com.ar',
        'X-Rently-Client-Id': 'laburen',
        'X-Rently-Client-Secret': 'ySGx5SSRMNWc7KypPYlU+YXRhVDEjXl0leTZpK3I/eC1LalF2e19NXipHb2s5cSZLUS90WnVZeXQ1cUZtRi9vPw=='
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

    // Test 4: Verificar logs del servidor
    console.log('\n4️⃣ Logs esperados en el servidor:');
    console.log('🔝 [AuthConfig] Usando Headers HTTP para OAuth2');
    console.log('🔝 [Config] Usando baseUrl de Headers HTTP');
    console.log('🚀 [Config] Inicializado - Runtime: https://cliente-test.rently.com.ar');

    console.log('\n✅ Test con Headers HTTP completado');
    console.log('💡 Revisa los logs del servidor para confirmar el uso de headers');
}

// Ejecutar test
testWithHeaders().catch(console.error);