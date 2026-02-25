export interface ApiResponse<T> {
  data: T;
  meta?: ResponseMeta;
}

export interface ResponseMeta {
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

/**
 * Shape of an error response from ForgeError.toJSON()
 * Core package imports and uses this for ForgeError.toJSON() return type
 */
export interface ForgeErrorShape {
  code: string;
  statusCode: number;
  message: string;
  details?: unknown;
}

export interface ErrorResponse {
  error: ForgeErrorShape;
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}

export type { DeploymentLogsQuery, DeploymentLogsResponse } from "./schemas/api";
