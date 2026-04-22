import { Link } from "@tanstack/react-router";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { useMetricsSources } from "@/core/api/hooks/useMetrics";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface SourceHeaderProps {
  sourceType: string;
  sourceId: string;
}

const STATUS_STYLES: Record<string, string> = {
  healthy: "bg-emerald-500",
  unhealthy: "bg-red-500",
  starting: "bg-yellow-500",
  stopped: "bg-gray-400",
};

export function SourceHeader({ sourceType, sourceId }: SourceHeaderProps): React.ReactElement {
  const { data: sources, isLoading } = useMetricsSources({
    sourceType,
  });

  const source = sources?.find((s) => s.sourceId === sourceId);

  return (
    <div className="space-y-4 border-b border-border/50 pb-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <Link
          to="/metrics"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          Metrics
        </Link>
        <span>/</span>
        <span>{sourceType}</span>
        <span>/</span>
        <span className="text-foreground">{source?.sourceName ?? sourceId}</span>
      </div>

      {/* Title row */}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="font-serif text-3xl font-bold">
          {isLoading ? (
            <Skeleton className="inline-block h-9 w-64" />
          ) : (
            (source?.sourceName ?? sourceId)
          )}
        </h1>

        <Badge variant="outline" className="font-mono text-[10px] uppercase">
          {sourceType}
        </Badge>

        {source && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={cn(
                "inline-block h-2 w-2 rounded-full",
                STATUS_STYLES.healthy ?? "bg-gray-400"
              )}
            />
            <span className="font-mono text-[10px] uppercase">Running</span>
          </div>
        )}
      </div>
    </div>
  );
}
