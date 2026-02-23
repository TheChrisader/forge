import type { ErrorResponse } from "@forge/types";
import type { RetryOptions } from "./types";

export class ApiClientError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

export interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | string[]>;
  timeout?: number;
  retry?: RetryOptions;
}

export type RequestInterceptor = (
  request: RequestInit & { url: string }
) => RequestInit | Promise<RequestInit>;

export type ResponseInterceptor = (
  response: Response,
  request: RequestInit & { url: string }
) => Response | Promise<Response>;

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

export class ApiClient {
  private baseUrl: string;
  private defaultTimeout = 30000;
  private requestInterceptors: RequestInterceptor[] = [];
  private responseInterceptors: ResponseInterceptor[] = [];
  private defaultRetryOptions: RetryOptions = {};

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || import.meta.env.VITE_API_URL || "http://localhost:3000";
  }

  useRequest(interceptor: RequestInterceptor): void {
    this.requestInterceptors.push(interceptor);
  }

  useResponse(interceptor: ResponseInterceptor): void {
    this.responseInterceptors.push(interceptor);
  }

  private buildUrl(
    endpoint: string,
    params?: Record<string, string | number | boolean | string[]>
  ): string {
    const url = new URL(endpoint, this.baseUrl);

    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => url.searchParams.append(key, String(v)));
        } else {
          url.searchParams.append(key, String(value));
        }
      });
    }

    return url.toString();
  }

  private async request<T>(
    endpoint: string,
    options: RequestOptions = {},
    attempt: number = 1
  ): Promise<T> {
    const { params, timeout = this.defaultTimeout, retry, ...fetchOptions } = options;
    const retryOpts = { ...DEFAULT_RETRY_OPTIONS, ...this.defaultRetryOptions, ...retry };

    const url = this.buildUrl(endpoint, params);

    const headers = new Headers(fetchOptions.headers);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    const token = this.getAuthToken();
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }

    let finalFetchOptions: RequestInit = {
      ...fetchOptions,
      headers,
    };

    for (const interceptor of this.requestInterceptors) {
      Object.assign(finalFetchOptions, await interceptor({ ...finalFetchOptions, url }));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...finalFetchOptions,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let finalResponse = response;
      for (const interceptor of this.responseInterceptors) {
        finalResponse = await interceptor(finalResponse, { ...finalFetchOptions, url });
      }

      if (!finalResponse.ok) {
        const error = await this.handleErrorResponse(finalResponse);

        const shouldRetry =
          attempt < retryOpts.maxAttempts &&
          retryOpts.retryableStatuses?.includes(finalResponse.status);

        if (shouldRetry) {
          const delay = retryOpts.delayMs * Math.pow(retryOpts.backoffMultiplier, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, attempt + 1);
        }

        throw error;
      }

      const contentType = finalResponse.headers.get("Content-Type");
      if (!contentType || !contentType.includes("application/json")) {
        return {} as T;
      }

      const data = await finalResponse.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof ApiClientError) {
        const shouldRetry =
          attempt < retryOpts.maxAttempts &&
          (error.code === "NETWORK_ERROR" || error.code === "TIMEOUT");

        if (shouldRetry) {
          const delay = retryOpts.delayMs * Math.pow(retryOpts.backoffMultiplier, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, attempt + 1);
        }
        throw error;
      }

      if (error instanceof Error && error.name === "AbortError") {
        const timeoutError = new ApiClientError("Request timeout", 408, "TIMEOUT");

        if (attempt < retryOpts.maxAttempts) {
          const delay = retryOpts.delayMs * Math.pow(retryOpts.backoffMultiplier, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, attempt + 1);
        }

        throw timeoutError;
      }

      if (error instanceof TypeError) {
        const networkError = new ApiClientError("Network error", 0, "NETWORK_ERROR");

        if (attempt < retryOpts.maxAttempts) {
          const delay = retryOpts.delayMs * Math.pow(retryOpts.backoffMultiplier, attempt - 1);
          await new Promise((resolve) => setTimeout(resolve, delay));
          return this.request<T>(endpoint, options, attempt + 1);
        }

        throw networkError;
      }

      throw error;
    }
  }

  private async handleErrorResponse(response: Response): Promise<ApiClientError> {
    let errorData: ErrorResponse["error"];

    try {
      const json = (await response.json()) as { error?: ErrorResponse["error"] };
      errorData = json.error ?? {
        message: response.statusText || "Unknown error",
        code: "UNKNOWN_ERROR",
        statusCode: response.status,
      };
    } catch {
      errorData = {
        message: response.statusText || "Unknown error",
        code: "UNKNOWN_ERROR",
        statusCode: response.status,
      };
    }

    return new ApiClientError(
      errorData.message,
      response.status,
      errorData.code,
      errorData.details
    );
  }

  private getAuthToken(): string | null {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return null;
    }

    try {
      return localStorage.getItem("auth_token");
    } catch (error) {
      console.warn("Failed to access localStorage:", error);
      return null;
    }
  }

  public setAuthToken(token: string): void {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem("auth_token", token);
    } catch (error) {
      console.error("Failed to store auth token:", error);
    }
  }

  async get<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "GET",
    });
  }

  async post<T, D = unknown>(endpoint: string, data?: D, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T, D = unknown>(endpoint: string, data?: D, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T, D = unknown>(endpoint: string, data?: D, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
    return this.request<T>(endpoint, {
      ...options,
      method: "DELETE",
    });
  }
}

export const apiClient = new ApiClient();
