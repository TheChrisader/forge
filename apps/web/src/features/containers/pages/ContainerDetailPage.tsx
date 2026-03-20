import { useParams, Link } from "@tanstack/react-router";
import { useContainer, useContainerStats } from "@/core/api/hooks";
import { ContainerStatusBadge } from "../components/ContainerStatusBadge";
import { ContainerActions } from "../components/ContainerActions";
import { ContainerStatsCard } from "../components/ContainerStatsCard";
import { LoaderIcon, ArrowLeft, Settings, FileText, CpuIcon } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/shared/components/ui/card";
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
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
        <div className="flex items-center gap-4">
          {projectId && (
            <Link to="/projects/$projectId" params={{ projectId }}>
              <Button variant="ghost" size="sm" className="group">
                <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
              </Button>
            </Link>
          )}
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">
              {container.name || container.id.slice(0, 12)}
            </h1>
            <p className="font-mono text-xs text-muted-foreground">{container.id}</p>
          </div>
          <ContainerStatusBadge status={status} />
        </div>
        <div className="flex items-center gap-2">
          <Link to="/containers/$containerId/logs" params={{ containerId }}>
            <Button variant="outline" size="sm" className="group transition-all hover:shadow-md">
              <FileText className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
              <span className="font-sans text-sm">View Logs</span>
            </Button>
          </Link>
          <ContainerActions containerId={container.id} status={status} />
        </div>
      </div>

      <div className="space-y-6">
        {/* Stats */}
        <ContainerStatsCard stats={stats} isLoading={statsLoading} />

        {/* Configuration */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* Basic Info */}
          <Card className="group transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <CpuIcon className="h-4 w-4 text-primary" />
                </div>
                Container Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Image
                </p>
                <p className="font-mono text-sm text-foreground">{container.image}</p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  ID
                </p>
                <p className="font-mono text-sm text-foreground">{container.id}</p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Created
                </p>
                <p className="font-sans text-sm text-muted-foreground">
                  {container.created
                    ? formatDistanceToNow(new Date(container.created), {
                        addSuffix: true,
                      })
                    : "-"}
                </p>
              </div>
              <div className="space-y-1">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Status
                </p>
                <ContainerStatusBadge status={status} />
              </div>
            </CardContent>
          </Card>

          {/* Labels */}
          <Card className="group transition-all hover:shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-serif">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Settings className="h-4 w-4 text-primary" />
                </div>
                Labels
              </CardTitle>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                {container.labels && Object.keys(container.labels).length > 0
                  ? `${Object.keys(container.labels).length} labels`
                  : "No labels assigned"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {container.labels && Object.keys(container.labels).length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(container.labels).map(([key, value]) => (
                    <Badge key={key} variant="outline" className="font-mono text-[10px] uppercase">
                      {key}={value}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="font-sans text-sm text-muted-foreground/60">No labels</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
