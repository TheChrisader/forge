import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { useProjectContainers } from "@/core/api/hooks";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { LoaderIcon, BoxIcon } from "lucide-react";
import { ContainerFilterToggle } from "../components/ContainerFilterToggle";
import { ContainerListItem } from "../components/ContainerListItem";
import { partitionContainersByStatus, isTerminatedDockerStatus } from "../lib/container-filters";

interface ContainersPageProps {
  projectId: string;
}

export function ContainersPage({ projectId }: ContainersPageProps): React.ReactElement {
  const router = useRouter();
  const [showTerminated, setShowTerminated] = useState(false);
  const {
    data: containers,
    isLoading,
    error,
  } = useProjectContainers(projectId, {
    includeTerminated: true,
  });

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

  const { active, terminated } = partitionContainersByStatus(containers ?? []);
  const displayContainers = showTerminated ? [...active, ...terminated] : active;
  const activeCount = active.length;
  const terminatedCount = terminated.length;

  if (displayContainers.length === 0) {
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
            {activeCount} running{terminatedCount > 0 ? `, ${terminatedCount} terminated` : ""}
          </p>
        </div>
        <ContainerFilterToggle
          activeCount={activeCount}
          terminatedCount={terminatedCount}
          showTerminated={showTerminated}
          onToggle={setShowTerminated}
        />
      </div>

      <div className="grid gap-4">
        {displayContainers.map((container) => (
          <ContainerListItem
            key={container.id}
            container={container}
            router={router}
            dimmed={isTerminatedDockerStatus(container.status)}
          />
        ))}
      </div>
    </div>
  );
}
