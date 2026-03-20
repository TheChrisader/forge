import { Button } from "@/shared/components/ui/button";
import { useCacheStats, useClearCache } from "@/core/api/hooks/useCache";
import { HardDriveIcon, ClockIcon, LayersIcon } from "lucide-react";
import { toast } from "sonner";
import type { Project } from "@forge/types";
import { JSX } from "react";

interface CacheSettingsProps {
  project: Project;
}

export function CacheSettings({ project }: CacheSettingsProps): JSX.Element {
  const { data: stats, isLoading } = useCacheStats(project.id);
  const clearCache = useClearCache();

  const handleClear = async (): Promise<void> => {
    if (!confirm("Delete all cached build artifacts? Next build will be slower.")) {
      return;
    }

    try {
      await clearCache.mutateAsync({ projectId: project.id });
      toast.success("Cache cleared successfully");
    } catch (err) {
      const error = err as { code?: string; message?: string };
      if (error.code === "NOT_FOUND") {
        toast.error("Failed to clear cache", {
          description: "Project not found",
        });
      } else if (error.code === "FORBIDDEN") {
        toast.error("Failed to clear cache", {
          description: "You don't have permission to clear the cache",
        });
      } else {
        toast.error("Failed to clear cache", {
          description: error.message ?? "An unexpected error occurred. Please try again.",
        });
      }
    }
  };

  const formatBytes = (bytes: number): string => {
    const units = ["B", "KB", "MB", "GB"];
    let size = bytes;
    let unitIndex = 0;
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <div className="h-4 w-4 animate-pulse rounded-sm bg-muted" />
        Loading cache stats...
      </div>
    );
  }

  const hasEntries = (stats?.totalEntries ?? 0) > 0;

  return (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border/40 rounded-sm bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <LayersIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Artifacts</span>
          </div>
          <div className="text-xl font-semibold font-mono">{stats?.totalEntries ?? 0}</div>
        </div>
        <div className="border border-border/40 rounded-sm bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <HardDriveIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Cache Size</span>
          </div>
          <div className="text-xl font-semibold font-mono">
            {stats ? formatBytes(stats.totalSizeBytes) : "0 B"}
          </div>
        </div>
        <div className="border border-border/40 rounded-sm bg-muted/20 p-4">
          <div className="flex items-center gap-2 text-muted-foreground mb-1">
            <ClockIcon className="h-3.5 w-3.5" />
            <span className="text-xs font-medium">Avg Age</span>
          </div>
          <div className="text-xl font-semibold font-mono">{stats?.averageAgeDays ?? 0}d</div>
        </div>
      </div>

      {/* Info */}
      <div className="border border-border/40 rounded-sm bg-muted/10 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Caches node_modules and build artifacts between deployments. Automatically prunes entries
          older than 7 days.
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end pt-2">
        <Button
          variant="outline"
          onClick={() => {
            void handleClear();
          }}
          disabled={clearCache.isPending || !hasEntries}
        >
          {clearCache.isPending ? "Clearing..." : "Clear Cache"}
        </Button>
      </div>
    </div>
  );
}
