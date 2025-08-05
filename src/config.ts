// Configuración solo para autenticación OAuth2
export interface AuthConfig {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
}

// Configuración runtime para requests API
export interface RentlyConfig {
    baseUrl: string;
    token?: string;
    tokenExpiry?: number;
}

export interface RentlyEnv {
    BASE_URL?: string;
    CLIENT_ID?: string;
    CLIENT_SECRET?: string;
    [key: string]: string | undefined;
}

// Configuración por defecto para desarrollo
const DEFAULT_AUTH_CONFIG: AuthConfig = {
    baseUrl: "https://demo.rently.com",
    clientId: "demo_client",
    clientSecret: "demo_secret"
};

const DEFAULT_CONFIG: RentlyConfig = {
    baseUrl: "https://demo.rently.com"
};

export interface AuthResponse {
    access_token: string;
    expires_in: number;
    token_type: string;
}

// Configuración separada por responsabilidad
let currentConfig: RentlyConfig | null = null;
let currentAuthConfig: AuthConfig | null = null;

export function setRentlyConfig(config: RentlyConfig) {
    currentConfig = config;
}

export function setAuthConfig(config: AuthConfig) {
    currentAuthConfig = config;
}

// Obtener configuración de autenticación desde sistema de prioridades
function getAuthConfig(headers?: Headers, env?: RentlyEnv): AuthConfig {
    // 🔝 PRIORIDAD ALTA: Headers HTTP
    if (headers) {
        const baseUrl = headers.get('X-Rently-Base-Url');
        const clientId = headers.get('X-Rently-Client-Id');
        const clientSecret = headers.get('X-Rently-Client-Secret');

        if (baseUrl && clientId && clientSecret) {
            console.log('🔝 [AuthConfig] Usando Headers HTTP para OAuth2');
            return { baseUrl, clientId, clientSecret };
        }
    }

    // 🔄 PRIORIDAD MEDIA: Variables de Entorno
    if (env && env.BASE_URL && env.CLIENT_ID && env.CLIENT_SECRET) {
        console.log('🔄 [AuthConfig] Usando Variables de Entorno para OAuth2');
        return {
            baseUrl: env.BASE_URL,
            clientId: env.CLIENT_ID,
            clientSecret: env.CLIENT_SECRET
        };
    }

    // Fallback a configuración en memoria
    if (currentAuthConfig) {
        console.log('🔄 [AuthConfig] Usando configuración OAuth2 en memoria');
        return currentAuthConfig;
    }

    // 🛡️ PRIORIDAD BAJA: Configuración por Defecto
    console.log('🛡️ [AuthConfig] Usando configuración OAuth2 por defecto');
    return { ...DEFAULT_AUTH_CONFIG };
}

/**
 * Sistema de Prioridades de Configuración Runtime (3 niveles):
 * 🔝 Prioridad Alta: Headers HTTP (solo baseUrl)
 * 🔄 Prioridad Media: Variables de Entorno (solo baseUrl)
 * 🛡️ Prioridad Baja: Configuración por Defecto
 */
export function getRentlyConfig(headers?: Headers, env?: RentlyEnv): RentlyConfig {
    // 🔝 PRIORIDAD ALTA: Headers HTTP
    if (headers) {
        const baseUrl = headers.get('X-Rently-Base-Url');
        if (baseUrl) {
            console.log('🔝 [Config] Usando baseUrl de Headers HTTP');
            return { baseUrl };
        }
    }

    // 🔄 PRIORIDAD MEDIA: Variables de Entorno
    if (env && env.BASE_URL) {
        console.log('🔄 [Config] Usando baseUrl de Variables de Entorno');
        return { baseUrl: env.BASE_URL };
    }

    // Fallback a configuración en memoria si existe
    if (currentConfig) {
        console.log('🔄 [Config] Usando configuración runtime en memoria');
        return currentConfig;
    }

    // 🛡️ PRIORIDAD BAJA: Configuración por Defecto
    console.log('🛡️ [Config] Usando configuración runtime por defecto');
    return { ...DEFAULT_CONFIG };
}

/**
 * Inicializar configuración completa desde sistema de prioridades
 * Separa OAuth2 (AuthConfig) de Runtime (RentlyConfig)
 */
export function initializeConfig(headers?: Headers, env?: RentlyEnv): void {
    // Configurar credenciales OAuth2
    const authConfig = getAuthConfig(headers, env);
    setAuthConfig(authConfig);
    
    // Configurar runtime (solo baseUrl)
    const runtimeConfig = getRentlyConfig(headers, env);
    setRentlyConfig(runtimeConfig);
    
    console.log(`🚀 [Config] Inicializado - Runtime: ${runtimeConfig.baseUrl}, OAuth2: ${authConfig.baseUrl}`);
}

export async function refreshToken(): Promise<string> {
    // Usar AuthConfig para credenciales OAuth2
    const authConfig = currentAuthConfig || getAuthConfig();
    
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', authConfig.clientId);
    params.append('client_secret', authConfig.clientSecret);
    
    const response = await fetch(`${authConfig.baseUrl}/auth/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString()
    });
    
    if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`);
    }
    
    const authData = await response.json() as AuthResponse;
    
    // Actualizar solo el runtime config con el token
    const runtimeConfig = currentConfig || getRentlyConfig();
    runtimeConfig.token = authData.access_token;
    runtimeConfig.tokenExpiry = Date.now() + (authData.expires_in * 1000);
    setRentlyConfig(runtimeConfig);
    
    console.log('🔑 [Auth] Token OAuth2 renovado exitosamente');
    return authData.access_token;
}

export function getToken(): string | null {
    const config = currentConfig || getRentlyConfig();
    if (!config.token || !config.tokenExpiry || config.tokenExpiry <= Date.now()) {
        return null;
    }
    return config.token;
}

export async function ensureToken(): Promise<string> {
    const currentToken = getToken();
    if (currentToken) {
        return currentToken;
    }
    return await refreshToken();
}