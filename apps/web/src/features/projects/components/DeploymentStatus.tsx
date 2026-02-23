import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import type { DeploymentStatus as DeploymentStatusEnum } from "@forge/types";

interface DeploymentStatusProps {
  status: DeploymentStatusEnum;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const STATUS_CONFIG: Record<
  DeploymentStatusEnum,
  { label: string; category: "success" | "error" | "warning" | "progress" | "active" | "neutral" }
> = {
  PENDING: { label: "Queued", category: "progress" },
  QUEUED: { label: "Queued", category: "progress" },
  BUILDING: { label: "Building", category: "progress" },
  DEPLOYING: { label: "Deploying", category: "progress" },
  ROLLBACK: { label: "Rolling Back", category: "warning" },
  RUNNING: { label: "Running", category: "active" },
  SUCCEEDED: { label: "Live", category: "success" },
  FAILED: { label: "Failed", category: "error" },
  CANCELLED: { label: "Cancelled", category: "neutral" },
  TIMED_OUT: { label: "Timed Out", category: "error" },
};

export function DeploymentStatus({
  status,
  size = "sm",
  showLabel = true,
}: DeploymentStatusProps): React.ReactElement {
  const config = STATUS_CONFIG[status] || { label: status, category: "neutral" as const };

  return <StatusIndicator status={status} label={config.label} size={size} showLabel={showLabel} />;
}
