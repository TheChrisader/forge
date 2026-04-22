import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { apiClient } from "@/core/api/client";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { cn } from "@/shared/lib/utils";

interface Alert {
  id: string;
  ruleId: string;
  status: "FIRING" | "RESOLVED" | "ACKNOWLEDGED";
  severity: "INFO" | "WARNING" | "CRITICAL";
  value: number;
  message: string;
  firedAt: string;
  resolvedAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  sourceType?: string;
  sourceId?: string;
}

interface MetricAlertsListProps {
  projectId?: string | null;
}

function useActiveAlerts(projectId?: string | null): UseQueryResult<Alert[]> {
  return useQuery<Alert[]>({
    queryKey: ["alerts", "active", projectId],
    queryFn: async () => {
      try {
        const params: Record<string, string> = {};
        if (projectId) params.projectId = projectId;
        const res = await apiClient.get("/api/alerts", { params });
        return res as Alert[];
      } catch {
        return [];
      }
    },
    refetchInterval: 30_000,
    retry: 1,
  });
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-yellow-500",
  INFO: "bg-blue-500",
};

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function MetricAlertsList({ projectId }: MetricAlertsListProps): React.ReactElement {
  const { data: alerts, isLoading } = useActiveAlerts(projectId);

  const activeAlerts = useMemo(() => {
    if (!alerts) return [];
    return alerts.filter((a) => a.status === "FIRING").slice(0, 5);
  }, [alerts]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold">Active Alerts</h3>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-serif text-lg font-semibold">Active Alerts</h3>

      {!activeAlerts.length ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 p-4">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="font-mono text-xs text-muted-foreground">
            No active alerts — all systems normal
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {activeAlerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border/50 p-3",
                "hover:bg-accent/30 transition-colors"
              )}
            >
              <div className="mt-1.5">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    SEVERITY_STYLES[alert.severity] ?? "bg-gray-500"
                  )}
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs leading-relaxed truncate">{alert.message}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  {relativeTime(alert.firedAt)}
                </p>
              </div>
              {alert.sourceType && alert.sourceId && (
                <Link
                  to="/metrics/source/$sourceType/$sourceId"
                  params={{
                    sourceType: alert.sourceType.toLowerCase(),
                    sourceId: alert.sourceId,
                  }}
                  className="shrink-0 font-mono text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                >
                  View
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
