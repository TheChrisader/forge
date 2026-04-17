import { apiClient } from "../client";
import type { AuditLog, AuditLogQueryParams } from "@forge/types";

interface AuditLogResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

function serializeAuditLogParams(params: AuditLogQueryParams): Record<string, string | number> {
  const serialized: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    if (typeof value === "string" || typeof value === "number") {
      serialized[key] = value;
    }
  }
  return serialized;
}

export const auditLogsApi = {
  query: async (params: AuditLogQueryParams): Promise<AuditLogResponse> => {
    return apiClient.get("/api/audit-logs", {
      params: serializeAuditLogParams(params),
    });
  },
};
