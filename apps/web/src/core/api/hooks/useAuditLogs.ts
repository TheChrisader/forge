import { useQuery } from "@tanstack/react-query";
import { auditLogsApi } from "../clients/audit-logs";
import type { AuditLog, AuditLogQueryParams } from "@forge/types";

const AUDIT_LOG_REFRESH_INTERVAL_MS = 15_000;

interface AuditLogResponse {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export const auditLogKeys = {
  all: ["audit-logs"] as const,
  query: (params: AuditLogQueryParams) => [...auditLogKeys.all, "query", params] as const,
};

export function useAuditLogs(
  params: AuditLogQueryParams
): ReturnType<typeof useQuery<AuditLogResponse>> {
  return useQuery({
    queryKey: auditLogKeys.query(params),
    queryFn: () => auditLogsApi.query(params),
    refetchInterval: AUDIT_LOG_REFRESH_INTERVAL_MS,
  });
}
