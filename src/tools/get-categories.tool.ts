import { z } from "zod";
import { rentlyClient } from "../rently.client";
import type { Category, Model } from "../types/category";

interface GetCategoriesParams {
    token?: string;
    includeDetails?: boolean;
}

export const getCategoriesTool = {
    name: "get_categories",
    description: "Retrieve all vehicle categories with their available models and specifications",
    parameters: {
        token: z.string().optional().describe("Optional authentication token (will auto-refresh if not provided)"),
        includeDetails: z.boolean().optional().default(true).describe("Include detailed vehicle specifications"),
    },
    handler: async ({ token, includeDetails }: GetCategoriesParams) => {
        try {
            const categories = await rentlyClient.get<Category[]>('/api/categories', { token });
            
            const categoriesArray = categories.map((cat: Category) => ({
                categoryName: cat.Name,
                categoryId: cat.Id,
                vehicleCount: cat.Models?.length || 0,
                ...(includeDetails && {
                    autos: (cat.Models || []).map((m: Model) => ({
                        name: (m.Description || '').trim(),
                        id: m.Id,
                        brand: m.Brand?.Name || "-",
                        doors: m.Doors || 0,
                        passengers: m.Passengers || 0,
                        steering: m.Steering || '–',
                        gearbox: m.Gearbox || '–',
                        multimedia: m.Multimedia || '–',
                        airConditioner: m.AirConditioner || '–',
                        imagePath: m.ImagePath || '',
                        franchise: m.Franchise || 0
                    }))
                })
            }));

            return {
                content: [{ type: "text", text: JSON.stringify(categoriesArray, null, 2) }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
            };
        }
    }
};
