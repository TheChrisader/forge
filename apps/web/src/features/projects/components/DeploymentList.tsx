import { useRouter } from "@tanstack/react-router";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/shared/components/ui/item";
import { RocketIcon, ChevronRightIcon } from "lucide-react";
import { DeploymentStatus } from "./DeploymentStatus";
import type { Deployment } from "@forge/types";

interface DeploymentListProps {
  deployments: Deployment[];
  projectId: string;
  limit?: number;
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

function formatRelativeTime(timestamp: Date | string | null | undefined): string {
  if (!timestamp) return "Pending";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function DeploymentList({
  deployments,
  projectId,
  limit = 5,
}: DeploymentListProps): React.ReactElement | null {
  const router = useRouter();

  if (deployments.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-sm text-muted-foreground">No deployments yet</p>
        </CardContent>
      </Card>
    );
  }

  const displayDeployments = deployments.slice(0, limit);

  const handleDeploymentClick = async (deploymentId: string): Promise<void> => {
    await router.navigate({
      to: `/projects/${projectId}/deployments/${deploymentId}`,
    });
  };

  return (
    <Card>
      <CardContent className="p-0">
        <ItemGroup>
          {displayDeployments.map((deployment) => (
            <Item
              key={deployment.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => {
                void handleDeploymentClick(deployment.id);
              }}
            >
              <ItemMedia variant="icon">
                <RocketIcon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>
                  <div className="flex items-center gap-2">
                    <span>{deployment.version}</span>
                    <DeploymentStatus status={deployment.status} size="sm" showLabel={false} />
                  </div>
                </ItemTitle>
                <ItemDescription>{formatRelativeTime(deployment.createdAt)}</ItemDescription>
              </ItemContent>
              <ItemActions>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>
                    {formatDuration(
                      deployment.buildStartedAt,
                      deployment.buildCompletedAt || deployment.deployCompletedAt
                    )}
                  </span>
                </div>
                <Button variant="ghost" size="icon-sm" className="shrink-0">
                  <ChevronRightIcon />
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
