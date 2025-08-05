import { z } from 'zod';
import { rentlyClient } from '../rently.client';
import { Place } from '../types/place';

export const getPlacesTool = {
    name: "get_places",
    description: "Retrieve all available rental locations with detailed information",
    parameters: {
        token: z.string().optional().describe("Optional authentication token (will auto-refresh if not provided)"),
        format: z.enum(["raw", "formatted"]).optional().default("formatted")
            .describe("Response format: 'raw' for JSON data, 'formatted' for human-readable text"),
    },
    handler: async ({ token, format }: { token?: string; format?: "raw" | "formatted" }) => {
        try {
            const places = await rentlyClient.get<Place[]>('/api/places', { token });

            if (format === "raw") {
                return {
                    content: [{ type: "text", text: JSON.stringify(places, null, 2) }]
                };
            }

            const lines = [];
            for (const loc of places) {
                const returnPlaces = loc.AvailableReturnPlaces?.length > 0
                    ? loc.AvailableReturnPlaces.join(', ')
                    : 'No disponibles';
                
                lines.push(`### ${loc.Name} (id: ${loc.Id})`);
                lines.push(`Dirección: ${loc.Address} — Ciudad: ${loc.City} — País: ${loc.Country} — Lugares de devolución (IDs): ${returnPlaces}`);
                lines.push(`Categoría: ${loc.Category} — Precio: ${loc.Price === 0 ? 'Gratis' : `$${loc.Price}`}`);
                lines.push(`Opciones disponibles: ${loc.AvailableOperationOptions}`);
                lines.push('');
            }

            return {
                content: [{ type: "text", text: lines.join('\n') }]
            };

        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
            };
        }
    }
};
