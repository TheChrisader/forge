import { useState, useMemo } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { RocketIcon, LoaderIcon } from "lucide-react";
import { useCreateDeployment } from "@/core/api/hooks/useDeployments";
import { ApiClientError } from "@/core/api/client";
import { DeploymentStatus } from "./DeploymentStatus";
import { DeploymentList } from "./DeploymentList";
import type { Project, Deployment } from "@forge/types";

interface DeploymentSectionProps {
  project: Project;
  deployments: Deployment[];
}

export function DeploymentSection({
  project,
  deployments,
}: DeploymentSectionProps): React.ReactElement {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const createDeployment = useCreateDeployment();

  const latestDeployment = useMemo(() => {
    if (deployments.length === 0) return null;
    const sorted = [...deployments].sort((a, b) => {
      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return bTime - aTime;
    });
    return sorted[0];
  }, [deployments]);

  const hasActiveDeployment = useMemo(() => {
    return deployments.some((d) =>
      ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(d.status)
    );
  }, [deployments]);

  const handleDeploy = async (): Promise<void> => {
    setErrorMessage(null);

    try {
      await createDeployment.mutateAsync({
        projectId: project.id,
      });
    } catch (err) {
      const error = err as ApiClientError;

      if (error.code === "CONFLICT") {
        setErrorMessage("A deployment is already in progress");
      } else if (error.code === "NOT_FOUND") {
        setErrorMessage("Project not found");
      } else {
        setErrorMessage(error.message || "Failed to start deployment");
      }
    }
  };

  const canDeploy = !hasActiveDeployment && !createDeployment.isPending;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Deployments</CardTitle>
              <CardDescription>Create and manage project deployments</CardDescription>
            </div>

            <div className="flex items-center gap-3">
              {latestDeployment && (
                <DeploymentStatus status={latestDeployment.status} size="sm" showLabel={true} />
              )}

              <Button
                onClick={() => {
                  void handleDeploy();
                }}
                disabled={!canDeploy}
                variant="default"
                size="sm"
              >
                {createDeployment.isPending ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : hasActiveDeployment ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Deploying...
                  </>
                ) : (
                  <>
                    <RocketIcon className="mr-2 h-4 w-4" />
                    Deploy Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>

        {errorMessage && (
          <CardContent>
            <div className="rounded-md bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{errorMessage}</p>
            </div>
          </CardContent>
        )}
      </Card>

      {latestDeployment && (
        <Card>
          <CardHeader>
            <CardTitle>Latest Deployment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{latestDeployment.version}</span>
                  <Badge variant="outline">{latestDeployment.id.slice(0, 8)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Started {new Date(latestDeployment.createdAt).toLocaleString()}
                </p>
              </div>
              <DeploymentStatus status={latestDeployment.status} size="md" showLabel={true} />
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold">Deployment History</h3>
          {deployments.length > 5 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                void router.navigate({ to: "/deployments" });
              }}
            >
              View All
            </Button>
          )}
        </div>
        <DeploymentList deployments={deployments} projectId={project.id} limit={5} />
      </div>
    </div>
  );
}
