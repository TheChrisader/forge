import { useParams } from "@tanstack/react-router";
import { useDeployment, useDeploymentLogs } from "@/core/api/hooks/useDeployments";
import { LogsHeader } from "../components/LogsHeader";
import { LogsViewer } from "../components/LogsViewer";
import { LoaderIcon } from "lucide-react";

export function DeploymentLogsPage(): React.ReactElement {
  const { projectId, deploymentId } = useParams({
    from: "/authenticated/projects/$projectId/deployments/$deploymentId",
  });

  const {
    data: deployment,
    isLoading: deploymentLoading,
    error: deploymentError,
  } = useDeployment(deploymentId);

  const { logs, isLoading, isStreaming, error, progress } = useDeploymentLogs(deploymentId);

  if (deploymentLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span>Loading deployment...</span>
        </div>
      </div>
    );
  }

  if (deploymentError || !deployment) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive">
          {deploymentError ? "Failed to load deployment" : "Deployment not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="flex max-h-full flex-col">
      <div className="shrink-0">
        <LogsHeader deployment={deployment} projectId={projectId} isLoading={deploymentLoading} />
      </div>

      <LogsViewer
        logs={logs}
        isLoading={isLoading}
        isConnected={isStreaming}
        progress={progress}
        error={error}
      />
    </div>
  );
}
