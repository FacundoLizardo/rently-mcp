// Rently location and place management tools
// Tools for retrieving available places/locations for vehicle pickup and return

import { z } from 'zod';
import type { MCPTool, MCPToolResult } from '../types.js';
import type { ResolvedConfig } from '../../config/types.js';
import { RentlyClient } from '../../clients/rently-client.js';
import { ErrorHandler } from '../../utils/index.js';

/**
 * Tool to get all available places/locations for vehicle pickup and return
 */
export const getPlacesTool: MCPTool = {
  name: 'rently_get_places',
  description: 'Get all available places/locations for vehicle pickup and return',
  schema: z.object({
    category: z.enum(['Oficinas', 'Aeropuerto', 'Domicilios']).optional()
      .describe('Filter places by category'),
    city: z.string().optional()
      .describe('Filter places by city name (case-insensitive)'),
    includeCoordinates: z.boolean().optional().default(false)
      .describe('Include latitude/longitude coordinates in response')
  }),
  
  metadata: {
    category: 'rently',
    tags: ['location', 'places', 'pickup', 'return'],
    requiresAuth: true,
    cacheable: true,
    estimatedDuration: 2000
  },
  
  handler: async ({ category, city, includeCoordinates = false }, config: ResolvedConfig): Promise<MCPToolResult> => {
    try {
      const client = new RentlyClient(config);
      const response = await client.makeRequest('/api/places');
      
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
          branchOfficeId: place.BranchOfficeId,
          iataCode: place.BranchOfficeIATACode,
          isFranchise: place.IsFranchise,
          canAddCustomAddress: place.CanAddCustomAddress,
          isCustomAddress: place.IsCustomAddress,
          availableReturnPlaces: place.AvailableReturnPlaces,
          availableOperationOptions: place.AvailableOperationOptions
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
            filters: {
              category: category || 'all',
              city: city || 'all',
              includeCoordinates
            },
            places: formattedPlaces
          }, null, 2)
        }]
      };
    } catch (error) {
      return ErrorHandler.createToolErrorResponse(error, 'rently_get_places');
    }
  }
};