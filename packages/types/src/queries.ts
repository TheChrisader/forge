import type { LogLevel, SourceType } from "./entities";

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface LogQueryParams extends PaginationParams {
  since?: string;
  until?: string;
  level?: LogLevel | LogLevel[];
  sourceType?: SourceType;
  sourceId?: string;
  search?: string;
}

export interface MetricQueryParams {
  source?: string;
  metric?: string;
  from: string;
  to: string;
  interval?: string;
  aggregation?: "avg" | "sum" | "min" | "max" | "count";
}

export interface ProjectFilters extends PaginationParams, SortParams {
  status?: string[];
  type?: string[];
  sourceType?: string[];
  search?: string;
}

export interface DeploymentFilters extends PaginationParams, SortParams {
  projectId?: string;
  status?: string[];
}

export interface ContainerFilters extends PaginationParams, SortParams {
  projectId?: string;
  deploymentId?: string;
  status?: string[];
  name?: string;
}

export interface AuditLogQueryParams extends PaginationParams {
  action?: string;
  resourceType?: string;
  userId?: string;
  projectId?: string;
  since?: string;
  until?: string;
  search?: string;
}

export interface ServiceFilters extends PaginationParams, SortParams {
  projectId?: string;
  type?: string[];
  status?: string[];
}
