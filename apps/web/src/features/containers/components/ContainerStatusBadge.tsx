import type { ContainerStatus } from "@forge/database";
import { Badge } from "@/shared/components/ui/badge";
import { CheckCircle2, XCircle, Clock, AlertTriangle, PauseCircle, LoaderIcon } from "lucide-react";

interface ContainerStatusBadgeProps {
  status: ContainerStatus;
}

export function ContainerStatusBadge({ status }: ContainerStatusBadgeProps): React.ReactElement {
  const config = {
    CREATING: {
      label: "Creating",
      variant: "secondary" as const,
      icon: LoaderIcon,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" as const,
    },
    STARTING: {
      label: "Starting",
      variant: "secondary" as const,
      icon: LoaderIcon,
      className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" as const,
    },
    RUNNING: {
      label: "Running",
      variant: "default" as const,
      icon: CheckCircle2,
      className: "bg-green-500 hover:bg-green-600 text-white" as const,
    },
    HEALTHY: {
      label: "Healthy",
      variant: "default" as const,
      icon: CheckCircle2,
      className: "bg-emerald-500 hover:bg-emerald-600 text-white" as const,
    },
    UNHEALTHY: {
      label: "Unhealthy",
      variant: "destructive" as const,
      icon: AlertTriangle,
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" as const,
    },
    STOPPING: {
      label: "Stopping",
      variant: "secondary" as const,
      icon: Clock,
      className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300" as const,
    },
    STOPPED: {
      label: "Stopped",
      variant: "outline" as const,
      icon: PauseCircle,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" as const,
    },
    RESTARTING: {
      label: "Restarting",
      variant: "secondary" as const,
      icon: LoaderIcon,
      className: "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300" as const,
    },
    TERMINATED: {
      label: "Terminated",
      variant: "outline" as const,
      icon: XCircle,
      className: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300" as const,
    },
    ERROR: {
      label: "Error",
      variant: "destructive" as const,
      icon: XCircle,
      className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300" as const,
    },
  } as const;

  const { label, variant, icon: Icon, className } = config[status] ?? config.ERROR;

  return (
    <Badge variant={variant} className={className}>
      <Icon className="mr-1 h-3 w-3" />
      {label}
    </Badge>
  );
}
