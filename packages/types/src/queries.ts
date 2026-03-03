import type { LogLevel, SourceType } from "./entities";

// =============================================================================
// Common Query Parameters
// =============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface SortParams {
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

// =============================================================================
// Log Queries
// =============================================================================

export interface LogQueryParams extends PaginationParams {
  since?: string;
  until?: string;
  level?: LogLevel | LogLevel[];
  sourceType?: SourceType;
  sourceId?: string;
  search?: string;
}

// =============================================================================
// Metric Queries
// =============================================================================

export interface MetricQueryParams {
  source?: string;
  metric?: string;
  from: string;
  to: string;
  interval?: string;
  aggregation?: "avg" | "sum" | "min" | "max" | "count";
}

// =============================================================================
// Project Queries
// =============================================================================

export interface ProjectFilters extends PaginationParams, SortParams {
  status?: string[];
  type?: string[];
  sourceType?: string[];
  search?: string;
}

// =============================================================================
// Deployment Queries
// =============================================================================

export interface DeploymentFilters extends PaginationParams, SortParams {
  projectId?: string;
  status?: string[];
}

// =============================================================================
// Container Queries
// =============================================================================

export interface ContainerFilters extends PaginationParams, SortParams {
  projectId?: string;
  deploymentId?: string;
  status?: string[];
  name?: string;
}

// =============================================================================
// Service Queries
// =============================================================================

export interface ServiceFilters extends PaginationParams, SortParams {
  projectId?: string;
  type?: string[];
  status?: string[];
}
