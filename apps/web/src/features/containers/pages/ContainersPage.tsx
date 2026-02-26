import { Link, useRouter } from "@tanstack/react-router";
import { useProjectContainers } from "@/core/api/hooks";
import { ContainerStatusBadge } from "../components/ContainerStatusBadge";
import { ContainerActions } from "../components/ContainerActions";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { LoaderIcon, BoxIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ContainersPageProps {
  projectId: string;
}

function mapDockerStatusToDbStatus(
  dockerStatus: string
):
  | "RUNNING"
  | "STOPPED"
  | "CREATING"
  | "STARTING"
  | "STOPPING"
  | "RESTARTING"
  | "ERROR"
  | "TERMINATED" {
  const statusMap: Record<
    string,
    | "RUNNING"
    | "STOPPED"
    | "CREATING"
    | "STARTING"
    | "STOPPING"
    | "RESTARTING"
    | "ERROR"
    | "TERMINATED"
  > = {
    running: "RUNNING",
    exited: "STOPPED",
    created: "CREATING",
    paused: "STOPPED",
    restarting: "RESTARTING",
    removing: "STOPPING",
    dead: "TERMINATED",
  };
  return statusMap[dockerStatus] ?? "ERROR";
}

export function ContainersPage({ projectId }: ContainersPageProps): React.ReactElement {
  const router = useRouter();
  const { data: containers, isLoading, error } = useProjectContainers(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span>Loading containers...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-destructive">Failed to load containers</div>
        </CardContent>
      </Card>
    );
  }

  if (!containers || containers.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <BoxIcon className="h-12 w-12" />
          <EmptyTitle>No containers</EmptyTitle>
          <EmptyDescription>
            Containers will be created when you deploy this project
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Containers</h3>
          <p className="text-sm text-muted-foreground">
            {containers.length} container{containers.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      <div className="grid gap-4">
        {containers.map((container) => {
          const dbStatus = mapDockerStatusToDbStatus(container.status);

          return (
            <Card key={container.id}>
              <CardContent className="p-0">
                <div className="flex items-center justify-between p-4">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                      <BoxIcon className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          to="/containers/$containerId"
                          params={{ containerId: container.id }}
                          className="truncate font-medium hover:underline"
                        >
                          {container.name ||
                            container.id?.slice(0, 12) ||
                            container.id.slice(0, 12)}
                        </Link>
                        <ContainerStatusBadge status={dbStatus} />
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span className="font-mono">{container.image}</span>
                        <span>•</span>
                        <span>
                          {container.created
                            ? formatDistanceToNow(new Date(container.created), {
                                addSuffix: true,
                              })
                            : "Unknown"}
                        </span>
                      </div>
                    </div>
                  </div>
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
