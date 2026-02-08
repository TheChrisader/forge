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

export interface ErrorResponse {
  error: {
    message: string;
    code?: string;
    statusCode?: number;
    details?: unknown;
  };
}

export interface SuccessResponse {
  success: boolean;
  message?: string;
}
