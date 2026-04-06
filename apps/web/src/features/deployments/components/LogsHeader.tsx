import { useRouter } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { ArrowLeftIcon, DownloadIcon } from "lucide-react";
import { DeploymentStatus } from "@/features/projects/components/DeploymentStatus";
import { DeploymentUrl } from "./DeploymentUrl";
import type { DeploymentWithRelations } from "@forge/types";

interface LogsHeaderProps {
  deployment: DeploymentWithRelations | null | undefined;
  projectId: string;
  onDownloadLogs?: () => void;
  isLoading?: boolean;
}

function formatDuration(
  startedAt: Date | string | null | undefined,
  completedAt?: Date | string | null
): string {
  if (!startedAt) return "-";

  const start = typeof startedAt === "string" ? new Date(startedAt) : startedAt;
  const end = completedAt
    ? typeof completedAt === "string"
      ? new Date(completedAt)
      : completedAt
    : new Date();
  const diffMs = end.getTime() - start.getTime();

  if (diffMs < 1000) return `${diffMs}ms`;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  const diffSecsRem = diffSecs % 60;
  return diffSecsRem > 0 ? `${diffMins}m ${diffSecsRem}s` : `${diffMins}m`;
}

export function LogsHeader({
  deployment,
  projectId,
  onDownloadLogs,
  isLoading = false,
}: LogsHeaderProps): React.ReactElement {
  const router = useRouter();

  const handleBack = (): void => {
    void router.navigate({ to: `/projects/${projectId}` });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" onClick={handleBack}>
            <ArrowLeftIcon />
          </Button>
          <div>
            <h1 className="text-xl font-semibold">Loading deployment...</h1>
          </div>
        </div>
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="flex items-center justify-between border-b pb-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon-sm" onClick={handleBack}>
            <ArrowLeftIcon />
          </Button>
          <div>
            <h1 className="text-xl font-semibold text-destructive">Deployment not found</h1>
          </div>
        </div>
      </div>
    );
  }

  const duration = formatDuration(
    deployment.buildStartedAt || deployment.createdAt,
    deployment.buildCompletedAt || deployment.deployCompletedAt
  );

  return (
    <div className="flex items-center justify-between border-b pb-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={handleBack}>
          <ArrowLeftIcon />
        </Button>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{deployment.id.slice(0, 8)}</h1>
            <Badge variant="outline">ID: {deployment.id.slice(0, 8)}</Badge>
            <DeploymentStatus status={deployment.status} size="sm" showLabel={true} />
          </div>
          <p className="text-sm text-muted-foreground">
            Started {new Date(deployment.createdAt).toLocaleString()} • Duration: {duration}
          </p>
          {deployment.urls && deployment.urls.length > 0 && (
            <div className="flex items-center gap-2 mt-1.5">
              {deployment.urls.map((u) => (
                <DeploymentUrl key={u.id} url={u.url} />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onDownloadLogs && (
          <Button variant="outline" size="sm" onClick={onDownloadLogs}>
            <DownloadIcon />
            Download Logs
          </Button>
        )}
      </div>
    </div>
  );
}
