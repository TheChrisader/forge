import { useMemo } from "react";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useAlerts } from "@/core/api/hooks/useAlerts";
import { cn } from "@/shared/lib/utils";

interface MetricAlertsListProps {
  projectId?: string | null;
}

const SEVERITY_STYLES: Record<string, string> = {
  CRITICAL: "bg-red-500",
  WARNING: "bg-yellow-500",
  INFO: "bg-blue-500",
};

function relativeTime(dateStr: string | Date): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function MetricAlertsList({ projectId }: MetricAlertsListProps): React.ReactElement {
  const { data, isLoading } = useAlerts({
    status: ["FIRING"],
    limit: 5,
    projectId: projectId ?? undefined,
  });

  const activeAlerts = useMemo(() => {
    return data?.data ?? [];
  }, [data]);

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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
