import { z } from "zod";

interface ValidateSearchDatesParams {
    from: string;
    to: string;
}

export const validateSearchDatesTool = {
    name: "validate_search_dates",
    description: "Validate and format dates for availability search",
    parameters: {
        from: z.string().describe("Pickup date (various formats accepted)"),
        to: z.string().describe("Return date (various formats accepted)"),
    },
    handler: async ({ from, to }: ValidateSearchDatesParams) => {
        try {
            const fromDate = new Date(from);
            const toDate = new Date(to);
            const now = new Date();
            
            if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
                throw new Error("Invalid date format. Please provide valid dates.");
            }
            
            if (fromDate >= toDate) {
                throw new Error("Return date must be after pickup date.");
            }
            
            if (fromDate < now) {
                throw new Error("Pickup date cannot be in the past.");
            }
            
            const formattedFrom = fromDate.toISOString().split('T')[0];
            const formattedTo = toDate.toISOString().split('T')[0];
            const duration = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24));
            
            return {
                content: [{
                    type: "text",
                    text: JSON.stringify({
                        success: true,
                        formattedDates: {
                            from: formattedFrom,
                            to: formattedTo,
                        },
                        duration: `${duration} days`,
                        ready: true
                    }, null, 2)
                }]
            };
            
        } catch (error: any) {
            return {
                content: [{
                    type: "text",
                    text: `Date validation error: ${error.message}`
                }],
                isError: true
            };
        }
    }
};
