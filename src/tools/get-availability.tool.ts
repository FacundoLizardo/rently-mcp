import { z } from "zod";
import { rentlyClient } from "../rently.client";

interface GetAvailabilityParams {
    token?: string;
    from: string;
    to: string;
    fromPlace: string;
    onlyFullAvailability?: boolean;
}

export const getAvailabilityTool = {
    name: "get_availability",
    description: "Search for vehicle availability between specified dates and location",
    parameters: {
        token: z.string().optional().describe("Optional authentication token (will auto-refresh if not provided)"),
        from: z.string().describe("Pickup date in YYYY-MM-DD format"),
        to: z.string().describe("Return date in YYYY-MM-DD format"),
        fromPlace: z.string().describe("Pickup location ID (use get_places to find valid IDs)"),
        onlyFullAvailability: z.boolean().optional().default(true).describe("Only show fully available vehicles"),
    },
    handler: async ({ token, from, to, fromPlace, onlyFullAvailability }: GetAvailabilityParams) => {
        try {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
                throw new Error("Invalid date format. Please use YYYY-MM-DD format");
            }

            const queryParams = new URLSearchParams({
                'searchModel.from': from,
                'searchModel.to': to,
                'searchModel.fromPlace': fromPlace,
                'searchModel.onlyFullAvailability': onlyFullAvailability?.toString() || "true"
            });

            const data = await rentlyClient.get(`/api/search?${queryParams}`, { token });
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        searchCriteria: { from, to, fromPlace, onlyFullAvailability },
                        results: data
                    }, null, 2)
                }]
            };
            
        } catch (error) {
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: false,
                        error: error instanceof Error ? error.message : "Unknown error occurred"
                    }, null, 2)
                }],
                isError: true
            };
        }
    }
};
