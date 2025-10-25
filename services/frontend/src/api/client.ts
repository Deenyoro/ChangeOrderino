/**
 * API client using native fetch - NO AXIOS, NO URL MANIPULATION
 */

import { getToken } from '../keycloak';

// Get API base URL from runtime config
const getApiBaseUrl = () => {
  const runtimeConfig = (window as any).__RUNTIME_CONFIG__ || {};
  const base = runtimeConfig.API_URL || import.meta.env.VITE_API_URL || '/api';
  console.log('🔌 [CLIENT] Using API base:', base);
  return base;
};

// Build full ABSOLUTE URL explicitly with origin
const buildUrl = (path: string): string => {
  const base = getApiBaseUrl();
  const origin = window.location.origin; // e.g., http://10.2.6.141:3000

  // Strip leading/trailing slashes
  const cleanBase = base.replace(/^\/+/, '').replace(/\/+$/, '');
  const cleanPath = path.replace(/^\/+/, '');

  // Build ABSOLUTE URL: http://10.2.6.141:3000/api/v1/projects
  const fullUrl = `${origin}/${cleanBase}/${cleanPath}`;

  console.log('🔌 [FETCH CLIENT] Origin:', origin);
  console.log('🔌 [FETCH CLIENT] Built URL:', fullUrl);

  return fullUrl;
};

// Helper to handle fetch responses
const handleResponse = async <T>(response: Response): Promise<T> => {
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorJson = JSON.parse(errorText);

      // Handle FastAPI validation errors (422)
      if (response.status === 422 && errorJson.detail && Array.isArray(errorJson.detail)) {
        const validationErrors = errorJson.detail
          .map((err: any) => {
            const field = err.loc ? err.loc.join('.') : 'unknown';
            const message = err.msg || 'Invalid value';
            return `${field}: ${message}`;
          })
          .join(', ');
        errorMessage = `Validation Error: ${validationErrors}`;
      } else {
        errorMessage = errorJson.detail || errorJson.message || errorMessage;
      }
    } catch {
      // Use the raw text if not JSON
      errorMessage = errorText || errorMessage;
    }

    throw new Error(errorMessage);
  }

  // Handle blob responses
  if (response.headers.get('content-type')?.includes('application/pdf') ||
      response.headers.get('content-type')?.includes('application/octet-stream')) {
    return response.blob() as Promise<T>;
  }

  // Handle empty responses
  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  return JSON.parse(text) as T;
};

// Build headers with auth token
const buildHeaders = (customHeaders?: Record<string, string>): Record<string, string> => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

export interface RequestConfig {
  params?: Record<string, any>;
  headers?: Record<string, string>;
  responseType?: 'blob' | 'json';
}

// API client using native fetch
export const apiClient = {
  get: async <T = any>(url: string, config?: RequestConfig): Promise<{ data: T }> => {
    const fullUrl = buildUrl(url);

    // Add query parameters
    let finalUrl = fullUrl;
    if (config?.params) {
      const searchParams = new URLSearchParams();
      Object.entries(config.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        finalUrl = `${fullUrl}?${queryString}`;
      }
    }

    console.log('🔌 [FETCH] GET:', finalUrl);

    const response = await fetch(finalUrl, {
      method: 'GET',
      headers: buildHeaders(config?.headers),
    });

    const data = await handleResponse<T>(response);
    return { data };
  },

  post: async <T = any>(url: string, body?: any, config?: RequestConfig): Promise<{ data: T }> => {
    const fullUrl = buildUrl(url);
    console.log('🔌 [FETCH] POST:', fullUrl);

    // Don't set Content-Type for FormData - browser will set it with boundary
    const isFormData = body instanceof FormData;
    const headers = isFormData
      ? buildHeaders({ ...config?.headers, 'Content-Type': undefined as any })
      : buildHeaders(config?.headers);

    // Remove undefined Content-Type
    if (headers['Content-Type'] === undefined) {
      delete headers['Content-Type'];
    }

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers,
      body: isFormData ? body : JSON.stringify(body),
    });

    const data = await handleResponse<T>(response);
    return { data };
  },

  put: async <T = any>(url: string, body?: any, config?: RequestConfig): Promise<{ data: T }> => {
    const fullUrl = buildUrl(url);
    console.log('🔌 [FETCH] PUT:', fullUrl);

    const response = await fetch(fullUrl, {
      method: 'PUT',
      headers: buildHeaders(config?.headers),
      body: JSON.stringify(body),
    });

    const data = await handleResponse<T>(response);
    return { data };
  },

  patch: async <T = any>(url: string, body?: any, config?: RequestConfig): Promise<{ data: T }> => {
    const fullUrl = buildUrl(url);
    console.log('🔌 [FETCH] PATCH:', fullUrl);

    const response = await fetch(fullUrl, {
      method: 'PATCH',
      headers: buildHeaders(config?.headers),
      body: JSON.stringify(body),
    });

    const data = await handleResponse<T>(response);
    return { data };
  },

  delete: async <T = any>(url: string, config?: RequestConfig): Promise<{ data: T }> => {
    const fullUrl = buildUrl(url);
    console.log('🔌 [FETCH] DELETE:', fullUrl);

    const response = await fetch(fullUrl, {
      method: 'DELETE',
      headers: buildHeaders(config?.headers),
    });

    const data = await handleResponse<T>(response);
    return { data };
  },
};

export default apiClient;
