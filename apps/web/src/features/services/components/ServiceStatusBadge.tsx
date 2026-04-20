import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import type { ServiceStatus } from "@forge/types";

interface ServiceStatusBadgeProps {
  status: ServiceStatus;
  size?: "sm" | "md";
  showLabel?: boolean;
}

export function ServiceStatusBadge({
  status,
  size = "sm",
  showLabel = true,
}: ServiceStatusBadgeProps): React.ReactElement {
  return <StatusIndicator status={status} size={size} showLabel={showLabel} />;
}
