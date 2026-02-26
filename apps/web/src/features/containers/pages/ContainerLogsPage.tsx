import { useParams, Link } from "@tanstack/react-router";
import { useContainer, useContainerLogs } from "@/core/api/hooks";
import { ContainerStatusBadge } from "../components/ContainerStatusBadge";
import { LogsViewer } from "@/features/deployments/components/LogsViewer";
import { LoaderIcon, ArrowLeft } from "lucide-react";
import { Button } from "@/shared/components/ui/button";

export function ContainerLogsPage(): React.ReactElement {
  const { containerId } = useParams({
    from: "/authenticated/containers/$containerId/logs",
  });

  const {
    data: container,
    isLoading: containerLoading,
    error: containerError,
  } = useContainer(containerId);

  const { data: logsData, isLoading: logsLoading } = useContainerLogs(containerId, {
    tail: "all",
    follow: false,
  });

  const logs = logsData ?? [];
  const logsString = logs.join("\n");

  if (containerLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span>Loading container...</span>
        </div>
      </div>
    );
  }

  if (containerError || !container) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive">
          {containerError ? "Failed to load container" : "Container not found"}
        </div>
      </div>
    );
  }

  // Determine status from Docker container
  const status =
    container.status === "running"
      ? ("RUNNING" as const)
      : container.status === "exited"
        ? ("STOPPED" as const)
        : ("ERROR" as const);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-4">
          <Link to="/containers/$containerId" params={{ containerId }}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">{container.name || container.id.slice(0, 12)}</h1>
            <p className="text-sm text-muted-foreground">Container Logs</p>
          </div>
          <ContainerStatusBadge status={status} />
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <LogsViewer logs={logsString} isLoading={logsLoading} />
      </div>
    </div>
  );
}
