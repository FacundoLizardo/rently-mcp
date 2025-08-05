import { getRentlyConfig, ensureToken } from './config';

export interface RequestOptions extends Omit<RequestInit, 'body'> {
    body?: unknown;
    token?: string;
}

export class HttpError extends Error {
    constructor(
        public readonly status: number,
        public readonly statusText: string,
        public readonly body: unknown
    ) {
        super(`HTTP Error ${status}: ${statusText}`);
        this.name = 'HttpError';
    }
}

export class RentlyClient {
    private async getAuthToken(token?: string): Promise<string> {
        return token || await ensureToken();
    }

    private getBaseUrl(): string {
        return getRentlyConfig().baseUrl;
    }

    private async prepareRequest(
        path: string,
        options: RequestOptions = {}
    ): Promise<[string, RequestInit]> {
        const { token, body, headers: customHeaders, ...rest } = options;
        const authToken = await this.getAuthToken(token);
        const baseUrl = this.getBaseUrl();
        const url = `${baseUrl}${path}`;

        const headers: HeadersInit = {
            'Authorization': `Bearer ${authToken}`,
            ...customHeaders,
        };

        // Add Content-Type for requests with body
        if (body !== undefined) {
            headers['Content-Type'] = 'application/json';
        }

        const requestInit: RequestInit = {
            ...rest,
            headers,
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        };

        return [url, requestInit];
    }

    private async handleResponse<T>(response: Response): Promise<T> {
        if (!response.ok) {
            let errorBody;
            try {
                errorBody = await response.json();
            } catch {
                errorBody = await response.text();
            }
            throw new HttpError(response.status, response.statusText, errorBody);
        }

        // Handle empty responses
        if (response.status === 204) {
            return {} as T;
        }

        try {
            return await response.json();
        } catch (error) {
            throw new Error('Failed to parse response as JSON');
        }
    }

    public async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const [url, init] = await this.prepareRequest(path, { ...options, method: 'GET' });
        const response = await fetch(url, init);
        return this.handleResponse<T>(response);
    }

    public async post<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const [url, init] = await this.prepareRequest(path, { ...options, method: 'POST' });
        const response = await fetch(url, init);
        return this.handleResponse<T>(response);
    }

    public async put<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const [url, init] = await this.prepareRequest(path, { ...options, method: 'PUT' });
        const response = await fetch(url, init);
        return this.handleResponse<T>(response);
    }

    public async patch<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const [url, init] = await this.prepareRequest(path, { ...options, method: 'PATCH' });
        const response = await fetch(url, init);
        return this.handleResponse<T>(response);
    }

    public async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
        const [url, init] = await this.prepareRequest(path, { ...options, method: 'DELETE' });
        const response = await fetch(url, init);
        return this.handleResponse<T>(response);
    }

}

// Export singleton instance for backward compatibility
export const rentlyClient = new RentlyClient();
