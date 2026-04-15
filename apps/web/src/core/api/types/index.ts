export interface ApiError {
  message: string;
  code?: string;
  statusCode?: number;
  details?: unknown;
}

export interface RetryOptions {
  maxAttempts?: number;
  delayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

export interface ApiClientOptions {
  baseUrl?: string;
  timeout?: number;
  retryOptions?: RetryOptions;
  getAuthToken?: () => string | null;
}
