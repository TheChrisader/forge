import { useState, useCallback, useRef } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { containersApi } from "@/core/api/clients/containers";
import { containerKeys } from "@/core/api/hooks/useContainers";
import { ContainerStatusBadge } from "../components/ContainerStatusBadge";
import { ContainerActions } from "../components/ContainerActions";
import { ContainerStatsCard } from "../components/ContainerStatsCard";
import { TerminalComponent } from "../components/Terminal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { LoaderIcon, ArrowLeft, Settings, FileText, CpuIcon, TerminalIcon } from "lucide-react";
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
import { mapDockerStatusToDbStatus, isTerminatedDockerStatus } from "../lib/container-filters";
import type { DockerContainer, ContainerStats } from "@forge/types";

/**
 * Polling backoff configuration for terminated containers.
 * After Docker can no longer find a container, we progressively
 * slow down polling until giving up entirely.
 */
const BACKOFF_STEPS = [
  { afterMisses: 0, intervalMs: 5000 },
  { afterMisses: 3, intervalMs: 15_000 },
  { afterMisses: 6, intervalMs: 30_000 },
] as const;

const MAX_MISSES = 9;

function getBackoffInterval(consecutiveMisses: number): number | false {
  if (consecutiveMisses >= MAX_MISSES) return false;

  let intervalMs = BACKOFF_STEPS[0].intervalMs as number;
  for (const step of BACKOFF_STEPS) {
    if (consecutiveMisses >= step.afterMisses) {
      intervalMs = step.intervalMs;
    } else {
      break;
    }
  }
  return intervalMs;
}

function isContainerTerminated(container: DockerContainer): boolean {
  return isTerminatedDockerStatus(container.status);
}

export function ContainerDetailPage(): React.ReactElement {
  const { containerId } = useParams({
    from: "/authenticated/containers/$containerId",
  });

  const missCountRef = useRef(0);

  const {
    data: container,
    isLoading: containerLoading,
    error: containerError,
  } = useQuery<DockerContainer>({
    queryKey: containerKeys.detail(containerId),
    queryFn: async () => {
      const response = await containersApi.getById(containerId);
      return response.data;
    },
    enabled: !!containerId,
    refetchInterval: () => {
      if (missCountRef.current >= MAX_MISSES) return false;
      return getBackoffInterval(missCountRef.current);
    },
  });

  // Track misses and reset on successful live data
  if (container) {
    if (isContainerTerminated(container)) {
      missCountRef.current += 1;
    } else {
      missCountRef.current = 0;
    }
  }

  const projectId = container?.labels?.["forge.projectId"];
  const isTerminated = container ? isContainerTerminated(container) : false;
  const status = container ? mapDockerStatusToDbStatus(container.status) : ("ERROR" as const);

  const { data: stats, isLoading: statsLoading } = useQuery<ContainerStats | null>({
    queryKey: containerKeys.stats(containerId),
    queryFn: async () => {
      const response = await containersApi.getStats(containerId);
      return response.data;
    },
    enabled: !!containerId && !isTerminated,
    refetchInterval: isTerminated ? false : 5000,
  });

  const [terminalOpen, setTerminalOpen] = useState(false);
  const [terminalKey, setTerminalKey] = useState(0);

  const handleOpenTerminal = useCallback(() => {
    setTerminalKey((k) => k + 1);
    setTerminalOpen(true);
  }, []);

  const handleCloseTerminal = useCallback(() => {
    setTerminalOpen(false);
  }, []);

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

  const isRunning = container.status === "running";

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
        {!isTerminated && (
          <div className="flex items-center gap-2">
            <Link to="/containers/$containerId/logs" params={{ containerId }}>
              <Button variant="outline" size="sm" className="group transition-all hover:shadow-md">
                <FileText className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                <span className="font-sans text-sm">View Logs</span>
              </Button>
            </Link>
            {isRunning && (
              <Button
                variant="outline"
                size="sm"
                className="group transition-all hover:shadow-md"
                onClick={handleOpenTerminal}
              >
                <TerminalIcon className="mr-2 h-4 w-4 transition-transform group-hover:scale-110" />
                <span className="font-sans text-sm">Terminal</span>
              </Button>
            )}
            <ContainerActions containerId={container.id} status={status} />
          </div>
        )}
      </div>

      <div className="space-y-6">
        <ContainerStatsCard
          stats={stats}
          isLoading={statsLoading}
          containerTerminated={isTerminated}
        />

        <div className="grid gap-6 md:grid-cols-2">
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

      <Dialog open={terminalOpen} onOpenChange={setTerminalOpen}>
        <DialogContent
          className="flex h-[80vh] max-w-7xl flex-col p-0 gap-0"
          showCloseButton={false}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Terminal — {container.name || container.id.slice(0, 12)}</DialogTitle>
            <DialogDescription>
              Interactive shell session for container {container.name || container.id.slice(0, 12)}
            </DialogDescription>
          </DialogHeader>
          <TerminalComponent
            key={terminalKey}
            containerId={container.id}
            containerName={container.name}
            onClose={handleCloseTerminal}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
