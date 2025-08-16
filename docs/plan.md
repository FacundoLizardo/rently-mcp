# Rently API Integration Plan

## Step 1: Token Management Helper Function

### Overview
Create a helper function within the RentlyClient class to handle OAuth2 client credentials authentication for the Rently API.

### Authentication Requirements
- **Endpoint**: `https://taraborellirentacar.rently.com.ar/auth/token`
- **Method**: POST
- **Grant Type**: client_credentials
- **Credentials**:
  - `client_id`: laburen
  - `client_secret`: SGx5SSRMNWc7KypPYlU+YXRhVDEjXl0leTZpK3I/eC1LalF2e19NXipHb2s5cSZLUS90WnVZeXQ1cUZtRi9vPw==

### Implementation Details

#### 1.1 Token Caching Structure
```typescript
interface TokenCache {
  token: string;
  expiresAt: number;
  tokenType: string;
}
```

#### 1.2 RentlyClient Class Structure
```typescript
// src/clients/rently-client.ts
import { RestApiClient } from './rest-api-client.js';
import type { ResolvedConfig } from '../config/types.js';
import type { ApiRequestOptions, ApiResponse } from './rest-api-client.js';
import { createScopedLogger } from '../utils/index.js';

interface TokenCache {
  token: string;
  expiresAt: number;
  tokenType: string;
}

export class RentlyClient extends RestApiClient {
  private tokenCache: TokenCache | null = null;
  private tokenPromise: Promise<string> | null = null;
  private readonly logger = createScopedLogger('RentlyClient');
  
  constructor(config: ResolvedConfig) {
    const configMapping = {
      baseUrl: 'rentlyBaseUrl',
      clientId: 'rentlyClientId',
      clientSecret: 'rentlyClientSecret'
    };
    super(config, configMapping);
    
    this.logger.debug('RentlyClient initialized', {
      baseUrl: this.config.baseUrl,
      hasClientId: !!this.config.clientId,
      hasClientSecret: !!this.config.clientSecret
    });
  }
  
  /**
   * Override makeRequest to inject Bearer token automatically
   */
  public async makeRequest<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiResponse<T>> {
    // Get fresh token and inject into headers
    const token = await this.getAuthToken();
    const headers = {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    };
    
    return super.makeRequest<T>(endpoint, { ...options, headers });
  }
  
  private async getAuthToken(): Promise<string> {
    // Implementation details below
  }
  
  private async requestNewToken(): Promise<string> {
    // Implementation details below
  }
}
```

#### 1.3 Token Management Logic
```typescript
private async getAuthToken(): Promise<string> {
  // Check cache validity (with 5-minute buffer)
  if (this.tokenCache && this.tokenCache.expiresAt > Date.now() + 300000) {
    return this.tokenCache.token;
  }
  
  // Prevent concurrent token requests
  if (this.tokenPromise) {
    return await this.tokenPromise;
  }
  
  // Create new token request
  this.tokenPromise = this.requestNewToken();
  
  try {
    const token = await this.tokenPromise;
    return token;
  } finally {
    this.tokenPromise = null;
  }
}

private async requestNewToken(): Promise<string> {
  this.logger.debug('Requesting new authentication token');
  
  try {
    const authResponse = await fetch('https://taraborellirentacar.rently.com.ar/auth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
    
    if (!authResponse.ok) {
      const errorText = await authResponse.text();
      this.logger.error('Authentication failed', {
        status: authResponse.status,
        statusText: authResponse.statusText,
        response: errorText
      });
      throw new Error(`Authentication failed: ${authResponse.status} ${authResponse.statusText}`);
    }
    
    const tokenData = await authResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('No access token received from authentication endpoint');
    }
    
    // Cache the token
    this.tokenCache = {
      token: tokenData.access_token,
      expiresAt: Date.now() + (tokenData.expires_in * 1000),
      tokenType: tokenData.token_type || 'Bearer'
    };
    
    this.logger.debug('Token acquired successfully', {
      expiresIn: tokenData.expires_in,
      tokenType: this.tokenCache.tokenType
    });
    
    return this.tokenCache.token;
  } catch (error) {
    this.logger.error('Token acquisition failed', error);
    throw error;
  }
}
```

#### 1.4 Configuration Access
```typescript
// Access to configuration fields needed for authentication
get clientId(): string {
  return this.config.clientId || this.getConfigValue('rentlyClientId') || 'laburen';
}

get clientSecret(): string {
  return this.config.clientSecret || this.getConfigValue('rentlyClientSecret') || '';
}

private getConfigValue(key: string): any {
  // Helper to access configuration values with fallbacks
  return this.config[key] || this.config[key.toLowerCase()] || this.config[key.toUpperCase()];
}
```

#### 1.5 Client Export
```typescript
// src/clients/index.ts
export { RestApiClient } from './rest-api-client.js';
export { RentlyClient } from './rently-client.js';
```

#### 1.6 Configuration Mapping
Update configuration system to support:
- `rently-base-url` → `rentlyBaseUrl`
- `rently-client-id` → `rentlyClientId` 
- `rently-client-secret` → `rentlyClientSecret`

### Features
- **Automatic Token Caching**: Stores token with expiration timestamp
- **Refresh Buffer**: Refreshes token 5 minutes before expiry
- **Concurrency Protection**: Prevents multiple simultaneous token requests
- **Error Handling**: Proper error messages for authentication failures
- **Transparent Integration**: All API requests automatically include valid token

### Configuration Examples
```bash
# Headers (Priority 1)
curl -H "rently-base-url: https://taraborellirentacar.rently.com.ar" \
     -H "rently-client-id: laburen" \
     -H "rently-client-secret: SGx5SSRMNWc7..." \
     /mcp

# Environment Variables (Priority 2)
RENTLY_BASE_URL=https://taraborellirentacar.rently.com.ar
RENTLY_CLIENT_ID=laburen
RENTLY_CLIENT_SECRET=SGx5SSRMNWc7...
```

## Step 2: Get Places Tool

### Overview
Create a tool to retrieve all available places/locations where vehicles can be picked up or returned.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/places`
- **Method**: GET
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Parameters**: None required

### Response Structure
The API returns an array of place objects with the following structure:
```typescript
interface Place {
  AvailableReturnPlaces: number[];
  Id: number;
  Price: number;
  Name: string;
  Category: "Oficinas" | "Aeropuerto" | "Domicilios";
  Address: string;
  City: string;
  Country: string;
  BranchOfficeId: number;
  BranchOfficeName: string;
  BranchOfficeIATACode: string | null;
  IsFranchise: boolean;
  Latitude: number;
  Longitude: number;
  CanAddCustomAddress: boolean;
  IsCustomAddress: boolean;
  AvailableOperationOptions: "DeliveryAndReturn";
}
```

### Tool Implementation
```typescript
// src/tools/rently/location-tools.ts
import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

export const getPlacesTool: MCPTool = {
  name: 'rently_get_places',
  description: 'Get all available places/locations for vehicle pickup and return',
  schema: z.object({
    category: z.enum(['Oficinas', 'Aeropuerto', 'Domicilios']).optional()
      .describe('Filter places by category'),
    city: z.string().optional()
      .describe('Filter places by city name'),
    includeCoordinates: z.boolean().optional().default(false)
      .describe('Include latitude/longitude coordinates in response')
  }),
  
  handler: async ({ category, city, includeCoordinates = false }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      const response = await client.get('/api/places');
      
      let places = response.data;
      
      // Apply filters
      if (category) {
        places = places.filter((place: any) => place.Category === category);
      }
      
      if (city) {
        places = places.filter((place: any) => 
          place.City.toLowerCase().includes(city.toLowerCase())
        );
      }
      
      // Format response based on includeCoordinates flag
      const formattedPlaces = places.map((place: any) => {
        const basicInfo = {
          id: place.Id,
          name: place.Name,
          category: place.Category,
          address: place.Address,
          city: place.City,
          country: place.Country,
          price: place.Price,
          branchOffice: place.BranchOfficeName,
          canAddCustomAddress: place.CanAddCustomAddress,
          availableReturnPlaces: place.AvailableReturnPlaces
        };
        
        if (includeCoordinates && place.Latitude && place.Longitude) {
          return {
            ...basicInfo,
            coordinates: {
              latitude: place.Latitude,
              longitude: place.Longitude
            }
          };
        }
        
        return basicInfo;
      });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: formattedPlaces.length,
            places: formattedPlaces
          }, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_get_places');
    }
  }
};
```

### Tool Features
- **Category Filtering**: Filter by place type (Oficinas, Aeropuerto, Domicilios)
- **City Filtering**: Filter by city name (case-insensitive partial match)
- **Coordinate Control**: Option to include/exclude GPS coordinates
- **Formatted Response**: Clean, structured response with essential information
- **Error Handling**: Proper error responses using existing error handler

### Usage Examples
```bash
# Get all places
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_places",
    "arguments": {}
  }
}'

# Get only airport locations
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_places",
    "arguments": {
      "category": "Aeropuerto"
    }
  }
}'

# Get places in Buenos Aires with coordinates
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_places",
    "arguments": {
      "city": "Buenos Aires",
      "includeCoordinates": true
    }
  }
}'
```

### File Structure Addition
```
src/tools/rently/
├── index.ts              # Export all Rently tools
└── location-tools.ts     # Place/location management tools
```

## Step 3: Get Availability Tool

### Overview
Create a tool to search for vehicle availability with date and location filtering, including complex pricing and additionals processing.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/search`
- **Method**: GET
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Query Parameters**:
  - `searchModel.from` (optional): Pickup date (ISO date format)
  - `searchModel.to` (optional): Return date (ISO date format) 
  - `searchModel.fromPlace` (optional): Pickup place ID (from places endpoint)
  - `searchModel.onlyFullAvailability`: Always `true`
  - `searchModel.returnAdditionalsPrice`: Always `true`

### Client-Side Filtering Parameters
- `idVehiculo` (optional): Category ID to filter results by specific vehicle category (applied after API response)

### Response Processing
The API returns an array of vehicle availability objects with complex nested data including:
- Car and model information
- Pricing breakdown with taxes
- Available additionals and insurance options
- Franchise/deductible information
- Delivery and return place details

### TypeScript Interfaces
```typescript
// Core vehicle availability response types
interface VehicleAvailability {
  Car: {
    Id: string | null;
    Model: VehicleModel;
    CurrentBranchOfficeId: number;
    // ... other car properties
  };
  Category: VehicleCategory;
  FromDate: string;
  ToDate: string;
  DeliveryPlace: Place;
  ReturnPlace: Place;
  TotalDaysString: string;
  Price: number;
  CustomerPrice: number;
  PriceItems: PriceItem[];
  Additionals: DefaultAdditional[];
  AdditionalsPrice: AdditionalWithPrice[];
  Currency: string;
  // ... other properties
}

interface VehicleModel {
  Description: string;
  ImagePath: string;
  Brand: { Name: string };
  Doors: number;
  Passengers: number;
  Category: VehicleCategory;
  // ... franchise properties
}

interface VehicleCategory {
  Id: number;
  Name: string;
  Franchise: number;
  FranchiseDamage: number;
  FranchiseRollover: number;
  FranchiseTheft: number;
  FranchiseHail: number;
}

interface PriceItem {
  Description: string;
  Price: number;
  IsBookingPrice: boolean;
  Type: number;
  TypeId: number;
  UnitPrice: number;
  Quantity: number;
}

interface AdditionalWithPrice {
  Id: number;
  Name: string;
  Description: string;
  Price: number;
  PriceWithoutTaxes: number;
  DailyPrice: number;
  IsPriceByDay: boolean;
  MaxQuantityPerBooking: number;
  AvailableStock: number;
  Type: string;
  IsRequired: boolean;
  IsDefault: boolean;
  Order: number;
}

// Processed output types
interface ProcessedCategory {
  nombre: string;
  categoryId: number;
  precioBooking: number;
  priceItems: {
    items: ProcessedPriceItem[];
    total: number;
  };
  adicionales: ProcessedAdditional[];
  totalAdicionales: number;
  franquiciasOriginales: FranchiseInfo;
  franquicias: FranchiseInfo;
  currency: string;
}

interface ProcessedAdditional {
  id: number | null;
  nombre: string;
  descripcion: string;
  precio: number;
  precioSinImpuestos: number;
  preciodiario: number;
  isPriceByDay: boolean;
  maxQuantity: number;
  stock: number;
  order: number;
  isRequired: boolean;
  isDefault: boolean;
  tipo: 'default' | 'precio';
  quantity: number;
  seleccionado: boolean;
}

interface FranchiseInfo {
  deposito: number;
  daños: number;
  vuelcos: number;
  robo: number;
  granizo: number;
}
```

### Tool Implementation
```typescript
// src/tools/rently/availability-tools.ts
import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

export const getAvailabilityTool: MCPTool = {
  name: 'rently_get_availability',
  description: 'Search for vehicle availability with pricing and additionals information',
  schema: z.object({
    from: z.string().optional()
      .describe('Pickup date in ISO format (YYYY-MM-DD)'),
    to: z.string().optional()
      .describe('Return date in ISO format (YYYY-MM-DD)'),
    fromPlace: z.number().optional()
      .describe('Pickup place ID (get from rently_get_places)'),
    idVehiculo: z.number().optional()
      .describe('Vehicle category ID to filter by specific category'),
    selectedAdditionals: z.array(z.object({
      id: z.number(),
      quantity: z.number().default(1)
    })).optional().default([])
      .describe('Pre-selected additionals with quantities')
  }),
  
  handler: async ({ 
    from, 
    to, 
    fromPlace, 
    idVehiculo, 
    selectedAdditionals = [] 
  }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Build query parameters (idVehiculo is NOT sent to API)
      const params: Record<string, any> = {
        'searchModel.onlyFullAvailability': 'true',
        'searchModel.returnAdditionalsPrice': 'true'
      };
      
      if (from) params['searchModel.from'] = from;
      if (to) params['searchModel.to'] = to;
      if (fromPlace) params['searchModel.fromPlace'] = fromPlace;
      
      // Note: idVehiculo is used for client-side filtering only
      
      const response = await client.get('/api/search', { params });
      
      // Process the response using the complex parsing logic
      // idVehiculo is used for client-side filtering after API response
      const processedCategories = processVehicleAvailability(
        response.data, 
        selectedAdditionals,
        idVehiculo  // This filters the results after processing
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: processedCategories.length,
            filteredByCategory: !!idVehiculo,
            categoryId: idVehiculo,
            categories: processedCategories
          }, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_get_availability');
    }
  }
};

/**
 * Process vehicle availability data with complex pricing and additionals logic
 */
function processVehicleAvailability(
  vehicles: any[], 
  selectedAdditionals: Array<{id: number, quantity: number}> = [],
  filterCategoryId?: number
): ProcessedCategory[] {
  const categoriasMap = new Map<string, ProcessedCategory>();
  const yaVistos = new Set<string>();
  
  // Convert selectedAdditionals to webhook format for compatibility
  const adicionalesWebhook = selectedAdditionals.map(item => ({
    Additional: { Id: item.id },
    Quantity: item.quantity
  }));
  
  const idsRequeridos = new Set(selectedAdditionals.map(item => item.id));
  
  function aplicarReglasCobertura(
    franquiciasOriginales: FranchiseInfo, 
    adicionales: ProcessedAdditional[]
  ): FranchiseInfo {
    const franquiciasAjustadas = { ...franquiciasOriginales };
    
    const coberturaIntermedia = adicionales.find(adicional => 
      adicional.seleccionado && 
      (adicional.id === 2 || adicional.nombre.toLowerCase().includes('intermedia'))
    );
    
    const coberturaMaxima = adicionales.find(adicional => 
      adicional.seleccionado && 
      (adicional.id === 22 || adicional.nombre.toLowerCase().includes('máxima'))
    );
    
    if (coberturaIntermedia) {
      franquiciasAjustadas.daños = Math.round(franquiciasOriginales.daños * 0.5);
    } else if (coberturaMaxima) {
      franquiciasAjustadas.deposito = Math.round(franquiciasOriginales.deposito * 0.5);
      franquiciasAjustadas.daños = 0;
      franquiciasAjustadas.vuelcos = 0;
      franquiciasAjustadas.granizo = 0;
    }
    
    return franquiciasAjustadas;
  }
  
  function procesarAuto(auto: any): void {
    const model = auto?.Car?.Model ?? {};
    const brand = model.Brand?.Name ?? '';
    const descripcion = model.Description ?? '';
    const precioFinal = auto.CustomerPrice ?? auto?.PriceDetails?.CustomerPrice ?? 0;
    const categoria = model.Category?.Name ?? '';
    const categoriaId = model.Category?.Id ?? null;
    
    // Client-side filtering: Skip if filtering by category and doesn't match
    // This replicates the n8n workflow logic where idVehiculo filters results
    if (filterCategoryId && categoriaId !== filterCategoryId) {
      return;
    }
    
    const clave = `${descripcion}|${precioFinal}`;
    if (yaVistos.has(clave) || !categoria || categoriasMap.has(categoria)) {
      return;
    }
    yaVistos.add(clave);
    
    // Process PriceItems
    const priceItems = (auto.PriceItems || []).map((item: any) => ({
      nombre: item.Description || '',
      precio: item.Price || 0,
      isBookingPrice: item.IsBookingPrice || false,
      isPriceByDay: item.IsPriceByDay || false,
      currency: item.Currency || auto.Currency || 'ARS'
    }));
    
    const totalPriceItems = priceItems.reduce((sum, item) => sum + (item.precio || 0), 0);
    
    // Extract IDs of additionals already in PriceItems
    const idsEnPriceItems = new Set<number>();
    (auto.PriceItems || []).forEach((item: any) => {
      if (item.TypeId && item.Type === 1) {
        idsEnPriceItems.add(item.TypeId);
      }
    });
    
    // Process default additionals
    const adicionalesDefault: ProcessedAdditional[] = (auto.Additionals || [])
      .filter((adicional: any) => !idsEnPriceItems.has(adicional.Id))
      .map((adicional: any) => ({
        id: adicional.Id || null,
        nombre: adicional.Name || '',
        descripcion: adicional.Description || '',
        precio: adicional.Price || 0,
        precioSinImpuestos: adicional.PriceWithoutTaxes || 0,
        preciodiario: adicional.DailyPrice || 0,
        isPriceByDay: adicional.IsPriceByDay || false,
        maxQuantity: adicional.MaxQuantityPerBooking || 0,
        stock: adicional.AvailableStock || adicional.Stock || 0,
        order: adicional.Order || 0,
        isRequired: adicional.IsRequired || false,
        isDefault: adicional.IsDefault || false,
        tipo: 'default' as const,
        quantity: 0,
        seleccionado: false
      }));
    
    // Process priced additionals (filtered by selected IDs)
    const adicionalesPrecioFiltrados: ProcessedAdditional[] = (auto.AdditionalsPrice || [])
      .filter((adicional: any) => 
        idsRequeridos.has(adicional.Id) && !idsEnPriceItems.has(adicional.Id)
      )
      .map((adicional: any) => ({
        id: adicional.Id || null,
        nombre: adicional.Name || '',
        descripcion: adicional.Description || '',
        precio: adicional.Price || 0,
        precioSinImpuestos: adicional.PriceWithoutTaxes || 0,
        preciodiario: adicional.DailyPrice || 0,
        isPriceByDay: adicional.IsPriceByDay || false,
        maxQuantity: adicional.MaxQuantityPerBooking || 0,
        stock: adicional.AvailableStock || adicional.Stock || 0,
        order: adicional.Order || 0,
        isRequired: adicional.IsRequired || false,
        isDefault: adicional.IsDefault || false,
        tipo: 'precio' as const,
        quantity: 0,
        seleccionado: false
      }));
    
    const adicionales = [...adicionalesDefault, ...adicionalesPrecioFiltrados];
    
    // Apply selections from webhook/selectedAdditionals
    adicionalesWebhook.forEach(seleccionado => {
      const id = seleccionado.Additional?.Id;
      const quantity = seleccionado.Quantity || 0;
      
      const adicional = adicionales.find(item => item.id === id);
      if (adicional) {
        adicional.quantity = quantity;
        adicional.seleccionado = true;
      }
    });
    
    // Calculate total additionals
    const totalAdicionales = adicionales
      .filter(item => item.seleccionado && item.quantity > 0)
      .reduce((sum, item) => sum + (item.precio * item.quantity), 0);
    
    // Map original franchises
    const franquiciasOriginales: FranchiseInfo = {
      deposito: model.Category?.Franchise ?? 0,
      daños: model.Category?.FranchiseDamage ?? 0,
      vuelcos: model.Category?.FranchiseRollover ?? 0,
      robo: model.Category?.FranchiseTheft ?? 0,
      granizo: model.Category?.FranchiseHail ?? 0
    };
    
    // Apply coverage rules
    const franquiciasAjustadas = aplicarReglasCobertura(franquiciasOriginales, adicionales);
    
    categoriasMap.set(categoria, {
      nombre: categoria,
      categoryId: categoriaId,
      precioBooking: precioFinal,
      priceItems: {
        items: priceItems,
        total: totalPriceItems
      },
      adicionales: adicionales,
      totalAdicionales: totalAdicionales,
      franquiciasOriginales: franquiciasOriginales,
      franquicias: franquiciasAjustadas,
      currency: auto.Currency || 'ARS'
    });
  }
  
  // Process all vehicles
  for (const auto of vehicles) {
    procesarAuto(auto);
  }
  
  return Array.from(categoriasMap.values());
}
```

### Tool Features
- **Date Range Search**: Optional pickup and return dates
- **Location Filtering**: Filter by pickup place ID
- **Category Filtering**: Filter by specific vehicle category ID
- **Complex Pricing**: Full breakdown of booking prices, taxes, and additionals
- **Franchise Calculation**: Automatic franchise adjustment based on insurance coverage
- **Additional Selection**: Pre-select additionals with quantities
- **Duplicate Prevention**: Avoids duplicate categories in results

### Usage Examples
```bash
# Search all available vehicles
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_availability",
    "arguments": {}
  }
}'

# Search with date range and location
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_availability",
    "arguments": {
      "from": "2025-09-20",
      "to": "2025-09-27",
      "fromPlace": 1
    }
  }
}'

# Search specific category with pre-selected additionals
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_availability",
    "arguments": {
      "idVehiculo": 11,
      "selectedAdditionals": [
        {"id": 22, "quantity": 1}
      ]
    }
  }
}'
```

### File Structure Addition
```
src/tools/rently/
├── index.ts              # Export all Rently tools
├── location-tools.ts     # Place/location management tools
└── availability-tools.ts # Vehicle availability and search tools
```

## Step 4: Get Additionals Tool

### Overview
Create a tool to retrieve available additionals (insurance, additional services) with pricing for a specific vehicle category and booking parameters.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/booking/additionals-price`
- **Method**: GET
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Query Parameters**:
  - `request.categoryId`: Vehicle category ID (required)
  - `request.fromDate`: Pickup date (ISO date format)
  - `request.toDate`: Return date (ISO date format)
  - `request.deliveryPlaceId`: Pickup place ID
  - `request.returnPlaceId`: Return place ID

### Response Structure
The API returns an array of additional objects with pricing information:
```typescript
interface RawAdditional {
  Id: number;
  Name: string;
  Description: string;
  ImagePath: string;
  IsPriceByDay: boolean;
  Price: number;
  Taxes: number;
  PriceWithoutTaxes: number;
  DailyPrice: number;
  MaxQuantityPerBooking: number;
  Currency: string;
  AvailableStock: number;
  Type: "Insurance" | "Additional" | "Other";
  IsRequired: boolean;
  IsDefault: boolean;
  Excludes: number[];
  Order: number;
}

// Processed output format
interface ProcessedAdditional {
  Id: number;
  Name: string;
  Description: string;
  DailyPrice: number;
  Taxes: number;
  TotalPrice: number;
  Currency: string;
  Type: "Insurance" | "Additional" | "Other";
  IsRequired: boolean;
  AvailableStock: number;
  MaxQuantityPerBooking: number;
}
```

### Tool Implementation
```typescript
// src/tools/rently/additionals-tools.ts
import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

export const getAdditionalsTool: MCPTool = {
  name: 'rently_get_additionals',
  description: 'Get available additionals with pricing for a specific vehicle category and booking details',
  schema: z.object({
    categoryId: z.number()
      .describe('Vehicle category ID (required)'),
    fromDate: z.string()
      .describe('Pickup date in ISO format (YYYY-MM-DD)'),
    toDate: z.string()
      .describe('Return date in ISO format (YYYY-MM-DD)'),
    deliveryPlaceId: z.number()
      .describe('Pickup place ID'),
    returnPlaceId: z.number()
      .describe('Return place ID'),
    filterByType: z.enum(['Insurance', 'Additional', 'Other']).optional()
      .describe('Filter additionals by type'),
    includeRequired: z.boolean().optional().default(true)
      .describe('Include required additionals in results'),
    includeOptional: z.boolean().optional().default(true)
      .describe('Include optional additionals in results')
  }),
  
  handler: async ({ 
    categoryId,
    fromDate,
    toDate,
    deliveryPlaceId,
    returnPlaceId,
    filterByType,
    includeRequired = true,
    includeOptional = true
  }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Build query parameters
      const params = {
        'request.categoryId': categoryId.toString(),
        'request.fromDate': fromDate,
        'request.toDate': toDate,
        'request.deliveryPlaceId': deliveryPlaceId.toString(),
        'request.returnPlaceId': returnPlaceId.toString()
      };
      
      const response = await client.get('/api/booking/additionals-price', { params });
      
      // Process and clean the response data
      const processedAdditionals = processAdditionals(
        response.data,
        filterByType,
        includeRequired,
        includeOptional
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            total: processedAdditionals.length,
            categoryId: categoryId,
            dateRange: { from: fromDate, to: toDate },
            delivery: { placeId: deliveryPlaceId },
            return: { placeId: returnPlaceId },
            filters: {
              type: filterByType || 'all',
              includeRequired,
              includeOptional
            },
            additionals: processedAdditionals
          }, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_get_additionals');
    }
  }
};

/**
 * Process raw additionals data into clean format matching n8n output
 */
function processAdditionals(
  rawAdditionals: any[],
  filterByType?: string,
  includeRequired: boolean = true,
  includeOptional: boolean = true
): ProcessedAdditional[] {
  return rawAdditionals
    .filter(additional => {
      // Filter by type if specified
      if (filterByType && additional.Type !== filterByType) {
        return false;
      }
      
      // Filter by required/optional status
      if (additional.IsRequired && !includeRequired) {
        return false;
      }
      if (!additional.IsRequired && !includeOptional) {
        return false;
      }
      
      return true;
    })
    .map(additional => ({
      Id: additional.Id,
      Name: additional.Name || '',
      Description: additional.Description || '',
      DailyPrice: additional.DailyPrice || 0,
      Taxes: additional.Taxes || 0,
      TotalPrice: additional.Price || 0, // API's "Price" field is the total price
      Currency: additional.Currency || 'ARS',
      Type: additional.Type || 'Additional',
      IsRequired: additional.IsRequired || false,
      AvailableStock: additional.AvailableStock || 0,
      MaxQuantityPerBooking: additional.MaxQuantityPerBooking || 1
    }))
    .sort((a, b) => {
      // Sort by: Required first, then by Type, then by Name
      if (a.IsRequired !== b.IsRequired) {
        return a.IsRequired ? -1 : 1;
      }
      if (a.Type !== b.Type) {
        const typeOrder = { 'Insurance': 1, 'Additional': 2, 'Other': 3 };
        return (typeOrder[a.Type] || 4) - (typeOrder[b.Type] || 4);
      }
      return a.Name.localeCompare(b.Name);
    });
}
```

### Data Processing Logic
The tool converts the raw API response to match your n8n parsing output:

1. **Field Mapping**:
   - `Price` → `TotalPrice` (API's Price is the total including taxes)
   - `DailyPrice` → `DailyPrice` (daily rate without taxes)
   - `Taxes` → `Taxes` (tax amount)

2. **Filtering Options**:
   - Filter by type (Insurance, Additional, Other)
   - Include/exclude required additionals
   - Include/exclude optional additionals

3. **Clean Output**:
   - Removes unnecessary fields from API response
   - Standardized field names
   - Consistent data types

### Response Formatting Features
The tool now includes sophisticated response formatting that matches your n8n workflow:

1. **Argentine Locale Formatting**:
   - Dates in Spanish format (e.g., "20 de septiembre")
   - Currency in ARS format (e.g., "$ 745.737,58")
   - Time in 24-hour format

2. **User-Friendly Confirmation Message**:
   - Personalized greeting with customer name
   - Complete booking summary with emojis
   - Detailed price breakdown
   - Booking reference number
   - Friendly closing message

3. **Structured Data Output**:
   - Clean structured data for programmatic use
   - Formatted strings for display
   - Raw API response for reference
   - All key booking information extracted

4. **Error Handling**: Handles both array and single object responses from API

### Usage Examples
```bash
# Get all additionals for a category and booking
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_additionals",
    "arguments": {
      "categoryId": 11,
      "fromDate": "2025-09-20",
      "toDate": "2025-09-27",
      "deliveryPlaceId": 1,
      "returnPlaceId": 1
    }
  }
}'

# Get only insurance additionals
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_additionals",
    "arguments": {
      "categoryId": 11,
      "fromDate": "2025-09-20",
      "toDate": "2025-09-27",
      "deliveryPlaceId": 1,
      "returnPlaceId": 1,
      "filterByType": "Insurance"
    }
  }
}'

# Get only optional additionals (exclude required)
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_additionals",
    "arguments": {
      "categoryId": 11,
      "fromDate": "2025-09-20",
      "toDate": "2025-09-27",
      "deliveryPlaceId": 1,
      "returnPlaceId": 1,
      "includeRequired": false
    }
  }
}'
```

### File Structure Addition
```
src/tools/rently/
├── index.ts              # Export all Rently tools
├── location-tools.ts     # Place/location management tools
├── availability-tools.ts # Vehicle availability and search tools
└── additionals-tools.ts  # Additionals and pricing tools
```

### Integration with Other Tools
This tool works together with:
- `rently_get_places` - to get valid delivery/return place IDs
- `rently_get_availability` - to get category IDs from search results
- Future booking tools - to use selected additionals in reservations

## Step 5: Get Client Tool

### Overview
Create a tool to retrieve customer information by document ID from the Rently system.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/customers`
- **Method**: GET
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Query Parameters**:
  - `filter`: Document ID of the customer to search for

### Tool Implementation
```typescript
// src/tools/rently/customer-tools.ts
import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

export const getClientTool: MCPTool = {
  name: 'rently_get_client',
  description: 'Get customer information by document ID',
  schema: z.object({
    documentId: z.string()
      .describe('Document ID of the customer to search for (DNI, passport, etc.)')
  }),
  
  handler: async ({ documentId }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Build query parameters
      const params = {
        filter: documentId
      };
      
      const response = await client.get('/api/customers', { params });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            searchedDocumentId: documentId,
            found: response.data && response.data.length > 0,
            total: Array.isArray(response.data) ? response.data.length : 0,
            customers: response.data
          }, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_get_client');
    }
  }
};
```

### Tool Features
- **Document ID Search**: Find customers by their document ID (DNI, passport, etc.)
- **Simple Response**: Returns raw customer data from API
- **Search Validation**: Confirms if customer was found or not
- **Error Handling**: Proper error responses for API failures

### Usage Examples
```bash
# Search for customer by document ID
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_client",
    "arguments": {
      "documentId": "12345678"
    }
  }
}'

# Search for customer by passport
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_client",
    "arguments": {
      "documentId": "AA123456"
    }
  }
}'
```

### File Structure Addition
```
src/tools/rently/
├── index.ts              # Export all Rently tools
├── location-tools.ts     # Place/location management tools
├── availability-tools.ts # Vehicle availability and search tools
├── additionals-tools.ts  # Additionals and pricing tools
└── customer-tools.ts     # Customer management tools
```

### Integration with Other Tools
This tool helps with:
- Customer verification before booking
- Retrieving existing customer data for reservations
- Customer lookup for support and booking modifications

## Step 6: Create Booking Tool

### Overview
Create a comprehensive booking tool that aggregates data from multiple previous tool results to create a complete reservation. This tool expects to receive structured data from the user that has been gathered using the previous tools.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/booking/book`
- **Method**: POST
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Content-Type**: application/json

### Tool Parameters Structure
The tool receives aggregated data that should come from previous tool calls:

```typescript
interface BookingData {
  // Customer data (from rently_get_client)
  customer: {
    id?: number;
    globalId?: string;
    name: string;
    lastName: string;
    documentId: string;
    documentTypeId: string;
    emailAddress: string;
    birthDate?: string;
    driverLicenceNumber?: string;
    driverLicenseExpiration?: string;
    address?: string;
    zipCode?: string;
    cellPhone?: string;
    age?: number;
  };
  
  // Vehicle/Category data (from rently_get_availability)
  vehicle: {
    categoryId: number;
    modelData: any; // Full model object from availability
  };
  
  // Booking details
  booking: {
    fromDate: string; // ISO format
    toDate: string;   // ISO format
    deliveryPlaceId: number;
    returnPlaceId: number;
  };
  
  // Selected additionals (from rently_get_additionals)
  additionals: Array<{
    additional: {
      id: number;
      isPriceByDay: boolean;
      price: number;
      maxQuantityPerBooking: number;
      stock?: number;
      order?: number;
    };
    quantity: number;
  }>;
  
  // Additional data
  extraData?: {
    datosAdicionales?: string; // JSON string of additional data
    isQuotation?: boolean;
  };
}
```

### Tool Implementation
```typescript
// src/tools/rently/booking-tools.ts
import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

export const createBookingTool: MCPTool = {
  name: 'rently_create_booking',
  description: 'Create a vehicle reservation using aggregated data from previous tool results',
  schema: z.object({
    // Customer information
    customer: z.object({
      id: z.number().optional(),
      globalId: z.string().optional(),
      name: z.string().describe('Customer first name'),
      lastName: z.string().describe('Customer last name'),
      documentId: z.string().describe('Customer document ID'),
      documentTypeId: z.string().describe('Document type ID'),
      emailAddress: z.string().email().describe('Customer email address'),
      birthDate: z.string().optional().describe('Birth date (YYYY-MM-DD)'),
      driverLicenceNumber: z.string().optional().describe('Driver license number'),
      driverLicenseExpiration: z.string().optional().describe('License expiration (YYYY-MM-DD)'),
      address: z.string().optional().describe('Customer address'),
      zipCode: z.string().optional().describe('ZIP/postal code'),
      cellPhone: z.string().optional().describe('Cell phone number'),
      age: z.number().optional().default(30).describe('Customer age')
    }),
    
    // Vehicle and category information
    vehicle: z.object({
      categoryId: z.number().describe('Vehicle category ID'),
      modelData: z.any().describe('Complete model data from availability search')
    }),
    
    // Booking details
    booking: z.object({
      fromDate: z.string().describe('Pickup date (ISO format)'),
      toDate: z.string().describe('Return date (ISO format)'),
      deliveryPlaceId: z.number().describe('Pickup place ID'),
      returnPlaceId: z.number().describe('Return place ID')
    }),
    
    // Place information (from rently_get_places)
    places: z.object({
      delivery: z.any().describe('Delivery place object'),
      return: z.any().describe('Return place object')
    }),
    
    // Selected additionals
    additionals: z.array(z.object({
      additional: z.object({
        id: z.number(),
        isPriceByDay: z.boolean().optional().default(false),
        price: z.number(),
        maxQuantityPerBooking: z.number().optional().default(1),
        stock: z.number().optional().default(0),
        order: z.number().optional().default(0)
      }),
      quantity: z.number().default(1)
    })).default([]),
    
    // Optional settings
    isQuotation: z.boolean().optional().default(false).describe('Create as quotation only'),
    extraData: z.string().optional().describe('Additional JSON data if needed')
  }),
  
  handler: async ({ 
    customer,
    vehicle,
    booking,
    places,
    additionals,
    isQuotation = false,
    extraData
  }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Build the complete booking payload
      const bookingPayload = buildBookingPayload({
        customer,
        vehicle,
        booking,
        places,
        additionals,
        isQuotation,
        extraData
      });
      
      const response = await client.post('/api/booking/book', bookingPayload);
      
      // Format the response like n8n workflow
      const formattedResponse = formatBookingResponse(response.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_create_booking');
    }
  }
};

/**
 * Build the complete booking payload from aggregated data
 */
function buildBookingPayload(data: {
  customer: any;
  vehicle: any;
  booking: any;
  places: any;
  additionals: any[];
  isQuotation: boolean;
  extraData?: string;
}) {
  const { customer, vehicle, booking, places, additionals, isQuotation } = data;
  const modelData = vehicle.modelData;
  
  return {
    FullResponse: true,
    IsFixedPrice: false,
    IsPriceAllInclusive: false,
    ForceExchangeRate: false,
    Id: 0,
    
    Customer: {
      Id: customer.id || 0,
      GlobalId: customer.globalId || "",
      Name: customer.name,
      LastName: customer.lastName,
      DocumentId: customer.documentId,
      DocumentTypeId: customer.documentTypeId,
      EmailAddress: customer.emailAddress,
      CreditCards: [],
      Memberships: [],
      Age: customer.age || 30,
      IsCompany: false,
      IsAgency: false,
      IsProvider: false,
      IsHotel: false,
      CommercialAgreements: [],
      HasWebLogin: false
    },
    
    Balance: 0,
    TotalPayed: 0,
    IsQuotation: isQuotation,
    
    Car: {
      Model: {
        Franchise: modelData?.Franchise || 0,
        FranchiseDamage: modelData?.FranchiseDamage || 0,
        FranchiseRollover: modelData?.FranchiseRollover || 0,
        FranchiseTheft: modelData?.FranchiseTheft || 0,
        FranchiseHail: modelData?.FranchiseHail || 0,
        Doors: modelData?.Doors || 4,
        Passengers: modelData?.Passengers || 5,
        BigLuggage: modelData?.BigLuggage || 2,
        SmallLuggage: modelData?.SmallLuggage || 2,
        Steering: modelData?.Steering || "Asistida",
        Gearbox: modelData?.Gearbox || "Manual",
        Multimedia: modelData?.Multimedia || "No",
        AirConditioner: modelData?.AirConditioner || "Si",
        DailyPrice: modelData?.DailyPrice || 0,
        ModelAttributes: modelData?.ModelAttributes || [],
        LowerPrice: modelData?.LowerPrice || 0,
        CreationDate: modelData?.CreationDate || "0001-01-01T00:00:00",
        Id: modelData?.Id || 0,
        SIPP: modelData?.SIPP || ""
      },
      CurrentBranchOfficeId: 0,
      CurrentKms: 0,
      Gasoline: 0,
      Year: 0,
      CreationDate: "0001-01-01T00:00:00"
    },
    
    Category: {
      Id: vehicle.categoryId,
      Order: modelData?.Category?.Order || 0,
      Franchise: modelData?.Category?.Franchise || 0,
      FranchiseDamage: modelData?.Category?.FranchiseDamage || 0,
      FranchiseRollover: modelData?.Category?.FranchiseRollover || 0,
      FranchiseTheft: modelData?.Category?.FranchiseTheft || 0,
      FranchiseHail: modelData?.Category?.FranchiseHail || 0
    },
    
    FromDate: booking.fromDate,
    ToDate: booking.toDate,
    DeliveryPlace: places.delivery,
    ReturnPlace: places.return,
    
    Price: 0,
    AgencyPrice: 0,
    CustomerPrice: 0,
    Currency: "ARS",
    TotalDays: 0,
    IlimitedKm: false,
    MaxAllowedDistance: 0,
    MaxAllowedDistanceByDay: 0,
    HasFranchiseModifiers: false,
    AverageDayPrice: 0,
    PriceItems: [],
    
    Additionals: additionals.map(item => ({
      Additional: {
        IsPriceByDay: item.additional.isPriceByDay,
        Price: item.additional.price,
        MaxQuantityPerBooking: item.additional.maxQuantityPerBooking,
        Stock: item.additional.stock,
        Order: item.additional.order,
        Id: item.additional.id
      },
      Quantity: item.quantity
    })),
    
    CurrentStatus: 0,
    CurrentStatusDate: new Date().toISOString(),
    IsCustomerOver25: (customer.age || 30) > 25,
    PrepaidAmount: 0,
    Attributes: {},
    DailyRate: 0,
    HourlyRate: 0,
    ExtraDayRate: 0,
    ExtraHourRate: 0,
    IsOnRequest: false,
    CreationDate: new Date().toISOString(),
    PayedByAgency: 0,
    PayedByCustomer: 0,
    SalesCommision: 0,
    IsTransfer: false,
    IsSelfCheckin: false
  };
}

/**
 * Format booking response to match n8n workflow output
 */
function formatBookingResponse(reserva: any) {
  // Handle array response (API returns array with single booking)
  if (Array.isArray(reserva)) {
    reserva = reserva[0];
  }
  
  // Extract main data
  const customer = reserva.Customer || {};
  const titular = `${customer.Firstname || ''} ${customer.Lastname || ''}`.trim();
  const email = customer.EmailAddress || '';
  const documento = customer.DocumentId || '';
  const idReserva = reserva.Id || '';
  const total = reserva.Price || reserva.CustomerPrice || reserva?.PriceDetails?.CustomerPrice || 0;
  
  // Format currency in Argentine style
  const totalFormateado = total.toLocaleString('es-AR', { 
    style: 'currency', 
    currency: 'ARS', 
    minimumFractionDigits: 2 
  });
  
  const vehiculo = reserva.Category?.Name || 'Categoría no disponible';
  const retiroLugar = reserva.DeliveryPlace?.Name || '';
  const devolucionLugar = reserva.ReturnPlace?.Name || '';
  
  // Format dates and times in Argentine style
  const retiroFecha = reserva.FromDate ? 
    new Date(reserva.FromDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' }) : '';
  const retiroHora = reserva.FromDate ? 
    new Date(reserva.FromDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
  const devolucionFecha = reserva.ToDate ? 
    new Date(reserva.ToDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' }) : '';
  const devolucionHora = reserva.ToDate ? 
    new Date(reserva.ToDate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
  
  // Process PriceItems breakdown
  const priceItems = (reserva.PriceItems || []).map(item => ({
    descripcion: item.Description || '',
    precio: item.Price || 0,
    precioFormateado: (item.Price || 0).toLocaleString('es-AR', { 
      style: 'currency', 
      currency: 'ARS', 
      minimumFractionDigits: 2 
    })
  }));
  
  // Format price items as text list
  const priceItemsTexto = priceItems
    .map(pi => `• ${pi.descripcion}: ${pi.precioFormateado}`)
    .join('\n');
  
  // Create formatted confirmation message
  const mensaje = `¡Listo, ${titular || 'cliente'}! Tu reserva ha sido confirmada exitosamente. Aquí están los detalles:

🚗 Vehículo: ${vehiculo}
📍 Retiro: ${retiroLugar} - ${retiroFecha}${retiroHora ? ', a las ' + retiroHora : ''}
📍 Devolución: ${devolucionLugar} - ${devolucionFecha}${devolucionHora ? ', a las ' + devolucionHora : ''}
👤 Titular: ${titular}
📧 Email: ${email}
🆔 Documento: ${documento}
💰 Total: ${totalFormateado}

📦 Detalle de la reserva:
${priceItemsTexto}

Tu número de reserva es ${idReserva}. Si necesitás hacer alguna consulta o modificación, podés usar este número. ¡Espero que disfrutes tu viaje! Si necesitás algo más, no dudes en decírmelo. 😊`;
  
  return {
    success: true,
    mensaje,
    idReserva,
    total,
    totalFormateado,
    vehiculo,
    retiroLugar,
    retiroFecha,
    retiroHora,
    devolucionLugar,
    devolucionFecha,
    devolucionHora,
    priceItems, // Structured array for programmatic use
    customer: {
      titular,
      email,
      documento
    },
    rawResponse: reserva // Include full API response for reference
  };
}
```

### Workflow Integration
This tool expects data from previous tool calls in the conversation:

1. **Get Places**: `rently_get_places` → delivery/return place objects
2. **Get Availability**: `rently_get_availability` → vehicle category and model data
3. **Get Additionals**: `rently_get_additionals` → selected additionals with pricing
4. **Get Client** (optional): `rently_get_client` → existing customer data
5. **Create Booking**: `rently_create_booking` → combines all data into reservation

### Usage Example
```bash
# Create booking with aggregated data
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_create_booking",
    "arguments": {
      "customer": {
        "name": "Lionel",
        "lastName": "Arce",
        "documentId": "41777386",
        "documentTypeId": "1",
        "emailAddress": "lionel@laburen.com",
        "age": 30
      },
      "vehicle": {
        "categoryId": 11,
        "modelData": { /* model data from availability call */ }
      },
      "booking": {
        "fromDate": "2025-09-20T10:00:00",
        "toDate": "2025-09-27T19:00:00",
        "deliveryPlaceId": 1,
        "returnPlaceId": 1
      },
      "places": {
        "delivery": { /* place object from places call */ },
        "return": { /* place object from places call */ }
      },
      "additionals": [
        {
          "additional": {
            "id": 22,
            "isPriceByDay": false,
            "price": 199792.45,
            "maxQuantityPerBooking": 1
          },
          "quantity": 1
        }
      ]
    }
  }
}'
```

### Agent Workflow Pattern
The user/agent should follow this pattern:

1. **Search places**: `rently_get_places()` 
2. **Search availability**: `rently_get_availability(from, to, fromPlace, idVehiculo?)`
3. **Get additionals**: `rently_get_additionals(categoryId, fromDate, toDate, deliveryPlaceId, returnPlaceId)`
4. **Check customer**: `rently_get_client(documentId)` (optional)
5. **Create booking**: `rently_create_booking(aggregated_data)`

### File Structure Addition
```
src/tools/rently/
├── index.ts              # Export all Rently tools
├── location-tools.ts     # Place/location management tools
├── availability-tools.ts # Vehicle availability and search tools
├── additionals-tools.ts  # Additionals and pricing tools
├── customer-tools.ts     # Customer management tools
└── booking-tools.ts      # Booking creation and management
```

## Step 7: Cancel Booking Tool

### Overview
Create a tool to cancel existing bookings using the booking ID and customer's lastname for verification.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/booking/cancel`
- **Method**: POST
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Content-Type**: application/json

### Request Body Structure
```json
{
  "FullResponse": true,
  "BookingId": "28425",
  "Lastname": "Arce"
}
```

### Tool Implementation
```typescript
// src/tools/rently/booking-tools.ts (add to existing file)
export const cancelBookingTool: MCPTool = {
  name: 'rently_cancel_booking',
  description: 'Cancel an existing booking using booking ID and customer lastname',
  schema: z.object({
    bookingId: z.string()
      .describe('The booking ID to cancel'),
    lastname: z.string()
      .describe('Customer lastname for verification (must match booking owner)')
  }),
  
  handler: async ({ bookingId, lastname }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Build cancellation payload
      const cancelPayload = {
        FullResponse: true,
        BookingId: bookingId,
        Lastname: lastname
      };
      
      const response = await client.post('/api/booking/cancel', cancelPayload);
      
      // Format the cancellation response
      const formattedResponse = formatCancellationResponse(response.data, bookingId, lastname);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_cancel_booking');
    }
  }
};

/**
 * Format cancellation response to match n8n workflow output
 */
function formatCancellationResponse(response: any, requestedBookingId: string, requestedLastname: string) {
  // Handle array response (API returns array with single booking)
  const bookingData = Array.isArray(response) ? response[0] : response;
  
  // Extract booking information
  const bookingInfo = {
    id: bookingData?.Id || null,
    customerId: bookingData?.Customer?.Id || null,
    customerName: bookingData?.Customer?.Name || null,
    customerEmail: bookingData?.Customer?.EmailAddress || null,
    documentId: bookingData?.Customer?.DocumentId || null,
    isQuotation: bookingData?.IsQuotation || false,
    category: bookingData?.Category?.Name || null,
    fromDate: bookingData?.FromDate || null,
    toDate: bookingData?.ToDate || null,
    totalDays: bookingData?.TotalDaysString || null,
    price: bookingData?.Price || 0,
    currency: bookingData?.Currency || 'ARS',
    currentStatus: bookingData?.CurrentStatus || null,
    statusDate: bookingData?.CurrentStatusDate || null,
    deliveryPlace: bookingData?.DeliveryPlace?.Name || null,
    returnPlace: bookingData?.ReturnPlace?.Name || null,
    balance: bookingData?.Balance || 0,
    totalPayed: bookingData?.TotalPayed || 0
  };
  
  // Format dates for display
  const fromDateFormatted = bookingInfo.fromDate ? 
    new Date(bookingInfo.fromDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' }) : '';
  const toDateFormatted = bookingInfo.toDate ? 
    new Date(bookingInfo.toDate).toLocaleDateString('es-AR', { day: '2-digit', month: 'long' }) : '';
  
  // Format price
  const priceFormatted = bookingInfo.price.toLocaleString('es-AR', { 
    style: 'currency', 
    currency: 'ARS', 
    minimumFractionDigits: 2 
  });
  
  // Create user-friendly cancellation message
  const mensaje = `✅ Reserva cancelada exitosamente

📋 Detalles de la cancelación:
🆔 Reserva: ${bookingInfo.id}
👤 Cliente: ${bookingInfo.customerName}
📧 Email: ${bookingInfo.customerEmail}
🚗 Vehículo: ${bookingInfo.category}
📅 Fechas: ${fromDateFormatted} - ${toDateFormatted} (${bookingInfo.totalDays})
📍 Retiro: ${bookingInfo.deliveryPlace}
📍 Devolución: ${bookingInfo.returnPlace}
💰 Monto: ${priceFormatted}

La reserva ha sido cancelada correctamente. Si tenés alguna consulta adicional, no dudes en contactarnos.`;
  
  // Prepare structured response matching n8n workflow
  const result = {
    success: true,
    message: "Booking cancelado exitosamente",
    mensaje, // User-friendly Spanish message
    bookingId: requestedBookingId,
    lastname: requestedLastname,
    cancellationDetails: {
      originalBookingId: bookingInfo.id,
      customerName: bookingInfo.customerName,
      customerEmail: bookingInfo.customerEmail,
      documentId: bookingInfo.documentId,
      category: bookingInfo.category,
      dates: {
        from: bookingInfo.fromDate,
        to: bookingInfo.toDate,
        fromFormatted: fromDateFormatted,
        toFormatted: toDateFormatted,
        duration: bookingInfo.totalDays
      },
      location: {
        delivery: bookingInfo.deliveryPlace,
        return: bookingInfo.returnPlace
      },
      pricing: {
        totalPrice: bookingInfo.price,
        totalPriceFormatted: priceFormatted,
        currency: bookingInfo.currency,
        balance: bookingInfo.balance,
        totalPayed: bookingInfo.totalPayed
      },
      status: {
        code: bookingInfo.currentStatus,
        date: bookingInfo.statusDate
      },
      wasQuotation: bookingInfo.isQuotation
    },
    timestamp: new Date().toISOString(),
    rawResponse: bookingData // Include full API response for reference
  };
  
  return result;
}
```

### Tool Features
- **Simple Parameters**: Only requires booking ID and lastname
- **Verification**: Uses lastname to verify booking ownership
- **Comprehensive Response**: Returns detailed cancellation information
- **User-Friendly Message**: Provides confirmation message in Spanish
- **Structured Data**: Clean data structure for programmatic use
- **Error Handling**: Proper error responses for invalid bookings

### Response Format
The tool returns structured data matching your n8n workflow:

```json
{
  "success": true,
  "message": "Booking cancelado exitosamente",
  "mensaje": "✅ Reserva cancelada exitosamente...",
  "bookingId": "28425",
  "lastname": "Arce",
  "cancellationDetails": {
    "originalBookingId": 28425,
    "customerName": "Lionel Arce",
    "customerEmail": "lioarce1@gmail.com",
    "category": "Compacto AT",
    "dates": {
      "from": "2025-09-20T10:00:00",
      "to": "2025-09-27T19:00:00",
      "fromFormatted": "20 de septiembre",
      "toFormatted": "27 de septiembre",
      "duration": "8 Días"
    },
    "pricing": {
      "totalPrice": 745737.58,
      "totalPriceFormatted": "$ 745.737,58",
      "currency": "ARS"
    },
    "status": {
      "code": 4,
      "date": "2025-08-15T14:39:58.3278346+00:00"
    }
  }
}
```

### Usage Examples
```bash
# Cancel a booking
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_cancel_booking",
    "arguments": {
      "bookingId": "28425",
      "lastname": "Arce"
    }
  }
}'
```

### Integration with Other Tools
This tool complements the booking workflow:
- Works with booking IDs from `rently_create_booking`
- Provides cancellation confirmation
- Can be used for customer service operations

### File Structure Update
```
src/tools/rently/
├── index.ts              # Export all Rently tools
├── location-tools.ts     # Place/location management tools
├── availability-tools.ts # Vehicle availability and search tools
├── additionals-tools.ts  # Additionals and pricing tools
├── customer-tools.ts     # Customer management tools
└── booking-tools.ts      # Booking creation and cancellation tools
```

### Error Handling
The tool handles common cancellation scenarios:
- Invalid booking ID
- Lastname mismatch
- Already cancelled bookings
- Network/API errors
- Authentication failures

## Step 8: Get Booking Details Tool

### Overview
Create a tool to retrieve detailed information about a specific booking using the booking ID as a path parameter.

### API Endpoint Details
- **URL**: `https://taraborellirentacar.rently.com.ar/api/booking/{bookingId}`
- **Method**: GET
- **Authentication**: Bearer token (handled automatically by RentlyClient)
- **Path Parameter**: `bookingId` - The booking ID to retrieve details for

### Tool Implementation
```typescript
// src/tools/rently/booking-tools.ts (add to existing file)
export const getBookingDetailsTool: MCPTool = {
  name: 'rently_get_booking_details',
  description: 'Get detailed information about a specific booking by ID',
  schema: z.object({
    bookingId: z.string()
      .describe('The booking ID to retrieve details for')
  }),
  
  handler: async ({ bookingId }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Make request with bookingId as path parameter
      const response = await client.get(`/api/booking/${bookingId}`);
      
      // Format the booking details response
      const formattedResponse = formatBookingDetailsResponse(response.data);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(formattedResponse, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_get_booking_details');
    }
  }
};

/**
 * Map booking status codes to Spanish descriptions
 */
function mapBookingStatus(status: number): string {
  const statusMap: Record<number, string> = {
    0: 'Pendiente',
    1: 'Confirmado',
    2: 'En curso',
    3: 'Completado',
    4: 'Cancelado',
    5: 'No show'
  };
  return statusMap[status] || 'Desconocido';
}

/**
 * Format date for display in Argentine format
 */
function formatDate(dateString: string | null): string {
  if (!dateString) return 'No especificado';
  const date = new Date(dateString);
  return date.toLocaleString('es-AR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'America/Argentina/Buenos_Aires'
  });
}

/**
 * Format booking details response to match n8n workflow output
 */
function formatBookingDetailsResponse(response: any) {
  // Handle array response (API returns array with single booking)
  const bookingData = Array.isArray(response) ? response[0] : response;
  
  if (!bookingData) {
    return {
      success: false,
      error: 'Booking not found',
      bookingId: null,
      data: null
    };
  }
  
  const formattedResponse = {
    success: true,
    bookingId: bookingData.Id,
    data: {
      estado: {
        codigo: bookingData.CurrentStatus,
        descripcion: mapBookingStatus(bookingData.CurrentStatus)
      },
      saldo: {
        balance: bookingData.Balance,
        total_pagado: bookingData.TotalPayed,
        moneda: bookingData.Currency || 'USD',
        precio_total: bookingData.Price
      },
      titular: {
        id: bookingData.Customer?.Id || null,
        nombre: bookingData.Customer?.Firstname || '',
        apellido: bookingData.Customer?.Lastname || '',
        nombre_completo: `${bookingData.Customer?.Firstname || ''} ${bookingData.Customer?.Lastname || ''}`.trim(),
        email: bookingData.Customer?.EmailAddress || null,
        documento_id: bookingData.Customer?.DocumentId || null,
        documento_tipo: bookingData.Customer?.DocumentTypeId || null,
        telefono: bookingData.Customer?.CellPhone || null,
        direccion: bookingData.Customer?.Address || null,
        pais: bookingData.Customer?.Country || null
      },
      horario_retiro: {
        id_lugar: bookingData.DeliveryPlace?.Id || null,
        nombre_lugar: bookingData.DeliveryPlace?.Name || 'No especificado',
        direccion: bookingData.DeliveryPlace?.Address || 'No especificado',
        ciudad: bookingData.DeliveryPlace?.City || 'No especificado',
        pais: bookingData.DeliveryPlace?.Country || 'No especificado',
        fecha_iso: bookingData.FromDate || null,
        fecha_formateada: formatDate(bookingData.FromDate)
      },
      horario_devolucion: {
        id_lugar: bookingData.ReturnPlace?.Id || null,
        nombre_lugar: bookingData.ReturnPlace?.Name || 'No especificado',
        direccion: bookingData.ReturnPlace?.Address || 'No especificado',
        ciudad: bookingData.ReturnPlace?.City || 'No especificado',
        pais: bookingData.ReturnPlace?.Country || 'No especificado',
        fecha_iso: bookingData.ToDate || null,
        fecha_formateada: formatDate(bookingData.ToDate)
      },
      categoria: {
        id: bookingData.Category?.Id || null,
        nombre: bookingData.Category?.Name || 'No especificado',
        franquicia: bookingData.Category?.Franchise || null,
        franquicia_daños: bookingData.Category?.FranchiseDamage || null,
        franquicia_vuelco: bookingData.Category?.FranchiseRollover || null,
        franquicia_robo: bookingData.Category?.FranchiseTheft || null,
        franquicia_granizo: bookingData.Category?.FranchiseHail || null
      },
      vehiculo: {
        id: bookingData.Car?.Model?.Id || null,
        modelo: bookingData.Car?.Model?.Name || 'No especificado',
        descripcion: bookingData.Car?.Model?.Description || 'No especificado',
        marca: bookingData.Car?.Model?.Brand?.Name || 'No especificado',
        puertas: bookingData.Car?.Model?.Doors || null,
        pasajeros: bookingData.Car?.Model?.Passengers || null,
        equipaje_grande: bookingData.Car?.Model?.BigLuggage || null,
        equipaje_pequeño: bookingData.Car?.Model?.SmallLuggage || null,
        direccion: bookingData.Car?.Model?.Steering || 'No especificado',
        caja: bookingData.Car?.Model?.Gearbox || 'No especificado',
        multimedia: bookingData.Car?.Model?.Multimedia || 'No especificado',
        aire_acondicionado: bookingData.Car?.Model?.AirConditioner || 'No especificado',
        imagen: bookingData.Car?.Model?.ImagePath || null,
        sipp: bookingData.Car?.Model?.SIPP || null
      },
      price_items: (bookingData.PriceItems || []).map(item => ({
        id: item.Id,
        descripcion: item.Description,
        precio: item.Price,
        precio_unitario: item.UnitPrice,
        cantidad: item.Quantity,
        tipo: item.Type,
        tipo_id: item.TypeId,
        es_precio_booking: item.IsBookingPrice,
        pagador: item.Payer
      })),
      additionals: (bookingData.Additionals || []).map(add => ({
        id: add.Additional?.Id || null,
        nombre: add.Additional?.Name || 'No especificado',
        descripcion: add.Additional?.Description || 'No especificado',
        imagen: add.Additional?.ImagePath || null,
        es_precio_por_dia: add.Additional?.IsPriceByDay || false,
        precio: add.Additional?.Price || 0,
        cantidad_maxima: add.Additional?.MaxQuantityPerBooking || null,
        tipo: add.Additional?.Type || null,
        stock: add.Additional?.Stock || null,
        orden: add.Additional?.Order || null,
        cantidad: add.Quantity || 0
      })),
      fechas: {
        desde: bookingData.FromDate,
        hasta: bookingData.ToDate,
        desde_formateada: formatDate(bookingData.FromDate),
        hasta_formateada: formatDate(bookingData.ToDate),
        duracion: bookingData.TotalDaysString || 'No especificado',
        dias_totales: bookingData.TotalDays || 0
      },
      precios: {
        precio_diario_promedio: bookingData.AverageDayPrice || 0,
        precio_diario: bookingData.DailyRate || 0,
        precio_por_hora: bookingData.HourlyRate || 0,
        kilometraje_ilimitado: bookingData.IlimitedKm || false,
        distancia_maxima: bookingData.MaxAllowedDistance || 0,
        distancia_maxima_por_dia: bookingData.MaxAllowedDistanceByDay || 0
      },
      sistema: {
        fecha_creacion: bookingData.CreationDate,
        fecha_estado_actual: bookingData.CurrentStatusDate,
        origen: bookingData.Origin?.Name || 'No especificado',
        es_cotizacion: bookingData.IsQuotation || false,
        es_transfer: bookingData.IsTransfer || false,
        balance: bookingData.Balance || 0,
        monto_prepago: bookingData.PrepaidAmount || 0
      }
    },
    timestamp: new Date().toISOString()
  };
  
  return formattedResponse;
}
```

### Tool Features
- **Path Parameter**: Uses booking ID as URL path parameter
- **Comprehensive Data**: Returns complete booking information
- **Status Mapping**: Converts status codes to Spanish descriptions
- **Date Formatting**: Formats dates in Argentine locale
- **Structured Response**: Clean, organized data structure
- **Error Handling**: Handles missing bookings and API errors

### Response Format
The tool returns detailed booking information matching your n8n workflow:

```json
{
  "success": true,
  "bookingId": 26533,
  "data": {
    "estado": {
      "codigo": 4,
      "descripcion": "Cancelado"
    },
    "saldo": {
      "balance": -418271.35,
      "total_pagado": 0,
      "moneda": "ARS",
      "precio_total": 418271.35
    },
    "titular": {
      "id": 21293,
      "nombre": "Cecilia",
      "apellido": "Mariel",
      "nombre_completo": "Cecilia Mariel",
      "email": "ceciliamg4206@gmail.com",
      "documento_id": "b7f2dcad-2dea-442c-a482-ea89ad674a3a"
    },
    "vehiculo": {
      "modelo": "Renegade",
      "descripcion": "Renegade Sport 1.8L AT6",
      "marca": "Jeep",
      "puertas": 5,
      "pasajeros": 5
    },
    "categoria": {
      "id": 17,
      "nombre": "SUV Economico AT",
      "franquicia": 750000
    },
    "horario_retiro": {
      "nombre_lugar": "Salta Sucursal Centro - Zuviria 110",
      "fecha_formateada": "01/10/2025, 10:00"
    },
    "price_items": [/* detailed price breakdown */],
    "additionals": [/* selected additionals */]
  }
}
```

### Usage Examples
```bash
# Get booking details
curl -X POST /mcp -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "rently_get_booking_details",
    "arguments": {
      "bookingId": "26533"
    }
  }
}'
```

### Integration with Other Tools
This tool complements the booking workflow:
- Can be used after `rently_create_booking` to verify created bookings
- Useful for customer service to check booking status
- Helps with booking modifications and cancellations
- Provides complete audit trail of booking changes

### Key Data Sections
1. **Estado**: Current booking status with Spanish descriptions
2. **Saldo**: Financial information (balance, payments, total price)
3. **Titular**: Customer information (name, email, document)
4. **Vehículo**: Vehicle details (model, brand, specifications)
5. **Categoría**: Vehicle category with franchise information
6. **Horarios**: Pickup and return dates/locations with formatting
7. **Price Items**: Detailed price breakdown
8. **Additionals**: Selected additional services
9. **Fechas**: Date information with multiple formats
10. **Sistema**: System metadata and creation details

### Error Handling
The tool handles various scenarios:
- Booking not found (returns success: false)
- Invalid booking ID format
- Network/API errors
- Authentication failures
- Malformed responses

### Next Steps
This is the eighth implementation step. Additional steps will be defined based on the specific API endpoints and tools required.