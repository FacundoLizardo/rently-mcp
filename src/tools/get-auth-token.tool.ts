import { z } from 'zod';
import { refreshToken } from '../config';

export const getAuthTokenTool = {
    name: "get_auth_token",
    description: "Authenticate and obtain access token for Rently API using OAuth2 client credentials",
    parameters: {},
    handler: async () => {
        try {
            const token = await refreshToken();
            return {
                content: [{ 
                    type: "text", 
                    text: JSON.stringify({ 
                        success: true,
                        token: token,
                        message: "Token obtained successfully using client_credentials grant"
                    }, null, 2) 
                }],
            };
        } catch (error: any) {
            return {
                content: [{ type: "text", text: `Error: ${error.message}` }],
            };
        }
    }
};
