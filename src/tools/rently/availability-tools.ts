// Rently vehicle availability and search tools
// Complex tool for searching vehicle availability with pricing and additionals processing

import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

/**
 * Core vehicle availability response types
 */
interface VehicleAvailability {
  Car: {
    Id: string | null;
    Model: VehicleModel;
    CurrentBranchOfficeId: number;
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
}

interface VehicleModel {
  Description: string;
  ImagePath: string;
  Brand: { Name: string };
  Doors: number;
  Passengers: number;
  Category: VehicleCategory;
  Franchise?: number;
  FranchiseDamage?: number;
  FranchiseRollover?: number;
  FranchiseTheft?: number;
  FranchiseHail?: number;
  BigLuggage?: number;
  SmallLuggage?: number;
  Steering?: string;
  Gearbox?: string;
  Multimedia?: string;
  AirConditioner?: string;
  DailyPrice?: number;
  ModelAttributes?: any[];
  LowerPrice?: number;
  CreationDate?: string;
  Id?: number;
  SIPP?: string;
}

interface VehicleCategory {
  Id: number;
  Name: string;
  Franchise: number;
  FranchiseDamage: number;
  FranchiseRollover: number;
  FranchiseTheft: number;
  FranchiseHail: number;
  Order?: number;
}

interface Place {
  Id: number;
  Name: string;
  Address: string;
  City: string;
  Country: string;
}

interface PriceItem {
  Description: string;
  Price: number;
  IsBookingPrice: boolean;
  Type: number;
  TypeId: number;
  UnitPrice: number;
  Quantity: number;
  IsPriceByDay?: boolean;
  Currency?: string;
}

interface DefaultAdditional {
  Id: number;
  Name: string;
  Description: string;
  Price: number;
  PriceWithoutTaxes: number;
  DailyPrice: number;
  IsPriceByDay: boolean;
  MaxQuantityPerBooking: number;
  AvailableStock: number;
  Stock?: number;
  Type: string;
  IsRequired: boolean;
  IsDefault: boolean;
  Order: number;
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
  Stock?: number;
  Type: string;
  IsRequired: boolean;
  IsDefault: boolean;
  Order: number;
}

/**
 * Processed output types
 */
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

interface ProcessedPriceItem {
  nombre: string;
  precio: number;
  isBookingPrice: boolean;
  isPriceByDay: boolean;
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

/**
 * Tool to search for vehicle availability with complex pricing and additionals processing
 */
export const getAvailabilityTool: MCPTool = {
  name: 'rently_get_availability',
  description: 'Search for vehicle availability with pricing and additionals information. Includes complex processing for Argentine peso formatting and date handling.',
  schema: z.object({
    from: z.string().optional()
      .describe('Pickup date in ISO format (YYYY-MM-DD)'),
    to: z.string().optional()
      .describe('Return date in ISO format (YYYY-MM-DD)'),
    fromPlace: z.number().optional()
      .describe('Pickup place ID (get from rently_get_places)'),
    idVehiculo: z.number().optional()
      .describe('Vehicle category ID to filter by specific category (client-side filtering)'),
    selectedAdditionals: z.array(z.object({
      id: z.number(),
      quantity: z.number().default(1)
    })).optional().default([])
      .describe('Pre-selected additionals with quantities for pricing calculations')
  }),
  
  metadata: {
    category: 'rently',
    tags: ['availability', 'search', 'vehicles', 'pricing', 'additionals'],
    requiresAuth: true,
    cacheable: false,
    estimatedDuration: 5000
  },
  
  handler: async ({ 
    from, 
    to, 
    fromPlace, 
    idVehiculo, 
    selectedAdditionals = [] 
  }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      
      // Build query parameters (idVehiculo is NOT sent to API - used for client-side filtering)
      const params: Record<string, any> = {
        'searchModel.onlyFullAvailability': 'true',
        'searchModel.returnAdditionalsPrice': 'true'
      };
      
      if (from) params['searchModel.from'] = from;
      if (to) params['searchModel.to'] = to;
      if (fromPlace) params['searchModel.fromPlace'] = fromPlace;
      
      // Note: idVehiculo is used for client-side filtering only, not sent to API
      
      const response = await client.makeRequest('/api/search', { params });
      
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
            searchParams: {
              from,
              to,
              fromPlace,
              selectedAdditionals: selectedAdditionals.length
            },
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
 * This replicates the n8n workflow processing patterns exactly
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
  
  /**
   * Apply coverage rules to adjust franchises based on selected insurance
   */
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
  
  /**
   * Process a single vehicle availability object
   */
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
    
    const totalPriceItems = priceItems.reduce((sum: number, item: any) => sum + (item.precio || 0), 0);
    
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
      .reduce((sum: number, item: ProcessedAdditional) => sum + (item.precio * item.quantity), 0);
    
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