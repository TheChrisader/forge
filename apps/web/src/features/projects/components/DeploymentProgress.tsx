import { useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Progress } from "@/shared/components/ui/progress";
import { Badge } from "@/shared/components/ui/badge";
import { ExternalLinkIcon, LoaderIcon, XCircleIcon, AlertCircleIcon } from "lucide-react";
import { useCancelDeployment } from "@/core/api/hooks/useDeployments";
import type { Deployment, DeploymentStatus } from "@forge/types";

interface DeploymentProgressProps {
  deployment: Deployment;
  projectId: string;
}

function getDeploymentProgress(status: DeploymentStatus): {
  value: number;
  label: string;
  variant?: "default" | "destructive";
} {
  switch (status) {
    case "PENDING":
    case "QUEUED":
      return { value: 10, label: "Queued" };
    case "BUILDING":
      return { value: 40, label: "Building" };
    case "DEPLOYING":
      return { value: 70, label: "Deploying" };
    case "SUCCEEDED":
      return { value: 100, label: "Live" };
    case "FAILED":
    case "CANCELLED":
      return {
        value: 0,
        label: status === "FAILED" ? "Failed" : "Cancelled",
        variant: "destructive",
      };
    default:
      return { value: 0, label: "Unknown" };
  }
}

function isActiveDeployment(status: DeploymentStatus): boolean {
  return ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(status);
}

function isCancellable(status: DeploymentStatus): boolean {
  return ["PENDING", "QUEUED", "BUILDING"].includes(status);
}

export function DeploymentProgress({
  deployment,
  projectId,
}: DeploymentProgressProps): React.ReactElement | null {
  const cancelDeployment = useCancelDeployment();

  const progress = useMemo(() => getDeploymentProgress(deployment.status), [deployment.status]);
  const isActive = useMemo(() => isActiveDeployment(deployment.status), [deployment.status]);
  const canCancel = useMemo(() => isCancellable(deployment.status), [deployment.status]);

  const handleCancel = async (): Promise<void> => {
    try {
      await cancelDeployment.mutateAsync(deployment.id);
    } catch {
      // Error is handled by the mutation hook
    }
  };

  const timeAgo = deployment.createdAt
    ? formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })
    : "Unknown time";

  return (
    <Card className="border-primary/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Deployment in Progress</CardTitle>
          <Badge variant={progress.variant === "destructive" ? "destructive" : "default"}>
            {progress.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium">{progress.value}%</span>
          </div>
          <Progress
            value={progress.value}
            className={progress.variant === "destructive" ? "bg-destructive/20" : ""}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{deployment.id.slice(0, 8)}</span>
              <Badge variant="outline" className="text-xs">
                Deployment
              </Badge>
            </div>
            <p className="text-muted-foreground">Started {timeAgo}</p>
          </div>

          <div className="flex items-center gap-2">
            {canCancel && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleCancel();
                }}
                disabled={cancelDeployment.isPending}
              >
                {cancelDeployment.isPending ? (
                  <>
                    <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  <>
                    <XCircleIcon className="mr-2 h-4 w-4" />
                    Cancel
                  </>
                )}
              </Button>
            )}

            <Link
              to="/projects/$projectId/deployments/$deploymentId"
              params={{ projectId, deploymentId: deployment.id }}
            >
              <Button variant="outline" size="sm">
                <ExternalLinkIcon className="mr-2 h-4 w-4" />
                View Logs
              </Button>
            </Link>
          </div>
        </div>

        {deployment.status === "FAILED" && deployment.error && (
          <div className="rounded-md bg-destructive/10 p-3">
            <div className="flex items-start gap-2">
              <AlertCircleIcon className="h-5 w-5 shrink-0 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium text-destructive">Deployment Failed</p>
                <p className="text-sm text-destructive/80">{deployment.error}</p>
              </div>
            </div>
          </div>
        )}

        {isActive && (
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm text-muted-foreground">
              {deployment.status === "BUILDING" &&
                "Your application is being built. This may take a few minutes..."}
              {deployment.status === "DEPLOYING" &&
                "Your application is being deployed to the infrastructure..."}
              {(deployment.status === "PENDING" || deployment.status === "QUEUED") &&
                "Your deployment is queued and will start shortly..."}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
