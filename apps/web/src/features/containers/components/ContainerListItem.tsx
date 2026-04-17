import { Card, CardContent } from "@/shared/components/ui/card";
import { BoxIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { DockerContainer } from "@forge/types";
import { router } from "@/core/router";
import { ContainerStatusBadge } from "./ContainerStatusBadge";
import { ContainerActions } from "./ContainerActions";
import { mapDockerStatusToDbStatus, getStatusBarColor } from "../lib/container-filters";

type AppRouter = typeof router;
interface ContainerListItemProps {
  container: DockerContainer;
  router: AppRouter;
  /** When true, applies dimmed/muted visual treatment for terminated containers */
  dimmed?: boolean;
}

/**
 * Shared container list item card used by both ContainersPage and
 * the project containers tab in ProjectDetailPage.
 */
export function ContainerListItem({
  container,
  router,
  dimmed = false,
}: ContainerListItemProps): React.ReactElement {
  const dbStatus = mapDockerStatusToDbStatus(container.status);
  const isRunning = container.status === "running";
  const timeAgo = container.created
    ? formatDistanceToNow(new Date(container.created), { addSuffix: true })
    : "Unknown";
  const statusBarColor = getStatusBarColor(container.status);
  const containerName = container.name || container.id?.slice(0, 12);

  return (
    <Card
      className={`group hover:border-border transition-colors overflow-hidden border-l-4 border-l-${statusBarColor.replace("bg-", "")} ${
        dimmed ? "opacity-60" : ""
      }`}
      onClick={() =>
        void router.navigate({
          to: "/containers/$containerId",
          params: { containerId: container.id },
        })
      }
    >
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <div className={`w-1 ${statusBarColor} ${isRunning && !dimmed ? "animate-pulse" : ""}`} />

          <div className="flex-1 p-3">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                  <BoxIcon
                    className={`h-4 w-4 ${dimmed ? "text-muted-foreground/40" : "text-muted-foreground"}`}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`font-mono text-xs font-medium truncate ${dimmed ? "text-muted-foreground" : ""}`}
                    >
                      {containerName}
                    </span>
                    <ContainerStatusBadge status={dbStatus} />
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                    <span className="font-mono">{container.image}</span>
                    <span className="text-border/50">&bull;</span>
                    <span>{timeAgo}</span>
                    {dimmed && (
                      <>
                        <span className="text-border/50">&bull;</span>
                        <span className="text-muted-foreground/50 italic">terminated</span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div
                className="flex items-center gap-1.5 shrink-0"
                onClick={(e) => e.stopPropagation()}
              >
                <ContainerActions
                  containerId={container.id}
                  status={dbStatus}
                  onViewDetails={() =>
                    void router.navigate({
                      to: "/containers/$containerId",
                      params: { containerId: container.id },
                    })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
