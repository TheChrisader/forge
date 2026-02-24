import { Button } from "@/shared/components/ui/button";
import { useCacheStats, useClearCache } from "@/core/api/hooks/useCache";
import type { Project } from "@forge/types";

interface CacheSettingsProps {
  project: Project;
}

export function CacheSettings({ project }: CacheSettingsProps): React.ReactElement {
  const { data: stats, isLoading } = useCacheStats(project.id);
  const clearCache = useClearCache();

  const handleClear = async (): Promise<void> => {
    if (!confirm("Delete all cached build artifacts? Next build will be slower.")) {
      return;
    }

    try {
      await clearCache.mutateAsync({ projectId: project.id });
    } catch (err) {
      // Show error toast
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
    return <div className="animate-pulse">Loading cache stats...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-4">
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Cached Artifacts</div>
          <div className="text-2xl font-semibold">{stats?.totalEntries ?? 0}</div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Cache Size</div>
          <div className="text-2xl font-semibold">
            {stats ? formatBytes(stats.totalSizeBytes) : "0 B"}
          </div>
        </div>
        <div className="border rounded-lg p-4">
          <div className="text-sm text-muted-foreground">Average Age</div>
          <div className="text-2xl font-semibold">{stats?.averageAgeDays ?? 0} days</div>
        </div>
      </div>

      <div className="border rounded-lg p-4 space-y-2">
        <h3 className="font-medium">Cache Configuration</h3>
        <div className="text-sm text-muted-foreground">
          Caches node_modules and other build artifacts between deployments. Automatically prunes
          entries older than 7 days.
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          onClick={() => {
            void handleClear();
          }}
          disabled={clearCache.isPending || (stats?.totalEntries ?? 0) === 0}
        >
          {clearCache.isPending ? "Clearing..." : "Clear Cache"}
        </Button>
      </div>
    </div>
  );
}
