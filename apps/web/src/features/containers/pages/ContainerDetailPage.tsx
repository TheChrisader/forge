import { useParams, Link } from "@tanstack/react-router";
import { useContainer, useContainerStats } from "@/core/api/hooks";
import { ContainerStatusBadge } from "../components/ContainerStatusBadge";
import { ContainerActions } from "../components/ContainerActions";
import { ContainerStatsCard } from "../components/ContainerStatsCard";
import { LoaderIcon, ArrowLeft, Settings, FileText } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

export function ContainerDetailPage(): React.ReactElement {
  const { containerId } = useParams({
    from: "/authenticated/containers/$containerId",
  });

  const {
    data: container,
    isLoading: containerLoading,
    error: containerError,
  } = useContainer(containerId);

  // Extract projectId from container labels (set by Forge when creating containers)
  const projectId = container?.labels?.["forge.projectId"];

  const { data: stats, isLoading: statsLoading } = useContainerStats(containerId);

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
          {projectId && (
            <Link to="/projects/$projectId" params={{ projectId }}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
          )}
          <div>
            <h1 className="text-2xl font-bold">{container.name || container.id.slice(0, 12)}</h1>
            <p className="text-sm text-muted-foreground">{container.id}</p>
          </div>
          <ContainerStatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/containers/$containerId/logs" params={{ containerId }}>
            <Button variant="outline" size="sm">
              <FileText className="mr-2 h-4 w-4" />
              View Logs
            </Button>
          </Link>
          <ContainerActions containerId={container.id} status={status} />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="space-y-6">
          {/* Stats */}
          <ContainerStatsCard stats={stats} isLoading={statsLoading} />

          {/* Configuration */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Basic Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Container Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium">Image</p>
                  <p className="text-sm text-muted-foreground">{container.image}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">ID</p>
                  <p className="text-sm text-muted-foreground font-mono">{container.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">Created</p>
                  <p className="text-sm text-muted-foreground">
                    {container.created
                      ? formatDistanceToNow(new Date(container.created), {
                          addSuffix: true,
                        })
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium">Status</p>
                  <ContainerStatusBadge status={status} />
                </div>
              </CardContent>
            </Card>

            {/* Labels */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Labels
                </CardTitle>
              </CardHeader>
              <CardContent>
                {container.labels && Object.keys(container.labels).length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(container.labels).map(([key, value]) => (
                      <Badge key={key} variant="outline" className="text-xs">
                        {key}={value}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No labels</p>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
