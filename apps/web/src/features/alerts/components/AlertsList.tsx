import { useMemo, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useAlerts, useAcknowledgeAlert, useResolveAlert } from "@/core/api/hooks/useAlerts";
import { cn } from "@/shared/lib/utils";

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  WARNING: "secondary",
  INFO: "outline",
};

const STATUS_DOT: Record<string, string> = {
  FIRING: "bg-red-500 animate-pulse",
  ACKNOWLEDGED: "bg-yellow-500",
  RESOLVED: "bg-emerald-500",
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

type StatusFilter = "all" | "FIRING" | "ACKNOWLEDGED" | "RESOLVED";

export function AlertsList(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { data, isLoading } = useAlerts({
    status: statusFilter === "all" ? undefined : [statusFilter],
    limit: 50,
  });
  const acknowledge = useAcknowledgeAlert();
  const resolve = useResolveAlert();

  const alerts = useMemo(() => data?.data ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="FIRING">Firing</SelectItem>
              <SelectItem value="ACKNOWLEDGED">Acknowledged</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
            </SelectContent>
          </Select>
          {data?.meta && (
            <span className="font-mono text-[10px] text-muted-foreground">
              {data.meta.total} alert{data.meta.total !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 p-8">
          <div className="h-2 w-2 rounded-full bg-emerald-500" />
          <p className="font-mono text-xs text-muted-foreground">
            {statusFilter === "all" ? "No alerts found" : `No ${statusFilter.toLowerCase()} alerts`}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={cn(
                "flex items-start gap-3 rounded-lg border border-border/50 p-4",
                "hover:bg-accent/30 transition-colors"
              )}
            >
              <div className="mt-1">
                <span
                  className={cn(
                    "inline-block h-2.5 w-2.5 rounded-full",
                    STATUS_DOT[alert.status] ?? "bg-gray-500"
                  )}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant={SEVERITY_VARIANT[alert.severity] ?? "outline"}>
                    {alert.severity}
                  </Badge>
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    {alert.status}
                  </span>
                </div>
                <p className="mt-1.5 font-mono text-xs leading-relaxed">{alert.message}</p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                  Fired {relativeTime(alert.firedAt)}
                  {alert.resolvedAt && ` · Resolved ${relativeTime(alert.resolvedAt)}`}
                </p>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {alert.status === "FIRING" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-mono text-[10px] h-7"
                    disabled={acknowledge.isPending}
                    onClick={() => acknowledge.mutate(alert.id)}
                  >
                    Acknowledge
                  </Button>
                )}
                {(alert.status === "FIRING" || alert.status === "ACKNOWLEDGED") && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="font-mono text-[10px] h-7"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate(alert.id)}
                  >
                    Resolve
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
