import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import type {
  DeploymentStatus,
  ServiceStatus,
  HealthStatus,
  JobEntityStatus,
  DockerContainerStatus,
  LogLevel,
} from "@forge/types";

/**
 * Semantic status categories for visual representation
 */
type StatusCategory =
  | "active" // Currently running/operational
  | "success" // Successfully completed
  | "progress" // In progress/transitional
  | "warning" // Degraded or needs attention
  | "error" // Failed or error state
  | "neutral" // Stopped, inactive, or pending
  | "unknown"; // Fallback for unrecognized statuses

/**
 * Maps all known status types to semantic categories
 */
const getStatusCategory = (status: string): StatusCategory => {
  const normalized = status.toLowerCase().replace(/_/g, "-");

  const statusMap: Record<string, StatusCategory> = {
    // Active/running states
    running: "active",
    healthy: "active",

    // Success states
    success: "success",

    // In-progress/transitional states
    pending: "progress",
    building: "progress",
    deploying: "progress",
    creating: "progress",
    starting: "progress",
    restarting: "progress",
    removing: "progress",

    // Warning/degraded states
    "rolled-back": "warning",
    unhealthy: "warning",
    paused: "warning",
    warn: "warning",

    // Error states
    failed: "error",
    error: "error",
    dead: "error",
    fatal: "error",

    // Neutral/inactive states
    stopped: "neutral",
    inactive: "neutral",
    exited: "neutral",
    idle: "neutral",
    created: "neutral",
    none: "neutral",
    trace: "neutral",
    debug: "neutral",
    info: "neutral",
  };

  return statusMap[normalized] ?? "unknown";
};

/**
 * Human-readable labels for common statuses
 */
const getStatusLabel = (status: string): string => {
  const normalized = status.toLowerCase().replace(/_/g, "-");

  const labelMap: Record<string, string> = {
    // Project/Deployment statuses
    active: "Active",
    inactive: "Inactive",
    pending: "Pending",
    building: "Building",
    deploying: "Deploying",
    running: "Running",
    failed: "Failed",
    "rolled-back": "Rolled Back",

    // Service statuses
    creating: "Creating",
    stopped: "Stopped",
    error: "Error",

    // Health statuses
    healthy: "Healthy",
    unhealthy: "Unhealthy",
    starting: "Starting",
    none: "Unknown",

    // Job statuses
    idle: "Idle",
    success: "Success",

    // Container statuses (Docker)
    created: "Created",
    paused: "Paused",
    restarting: "Restarting",
    removing: "Removing",
    exited: "Exited",
    dead: "Dead",

    // Log levels
    trace: "Trace",
    debug: "Debug",
    info: "Info",
    warn: "Warning",
    fatal: "Fatal",
  };

  return labelMap[normalized] ?? status;
};

const indicatorVariants = cva("inline-flex items-center gap-2 w-fit", {
  variants: {
    size: {
      sm: "",
      md: "",
      lg: "",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

const dotVariants = cva("rounded-full shrink-0 relative flex", {
  variants: {
    category: {
      active: "bg-success-500 dark:bg-success-400",
      success: "bg-success-500 dark:bg-success-400",
      progress: "bg-primary-500 dark:bg-primary-400",
      warning: "bg-warning-500 dark:bg-warning-400",
      error: "bg-destructive dark:bg-destructive/90",
      neutral: "bg-muted-foreground dark:bg-muted-foreground/70",
      unknown: "bg-muted-foreground dark:bg-muted-foreground/70",
    },
    size: {
      sm: "h-1.5 w-1.5",
      md: "h-2 w-2",
      lg: "h-2.5 w-2.5",
    },
    animated: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    {
      category: ["active", "progress"],
      animated: true,
      class: "animate-pulse",
    },
  ],
  defaultVariants: {
    size: "md",
    animated: false,
  },
});

const labelVariants = cva("font-medium", {
  variants: {
    category: {
      active: "text-success-700 dark:text-success-400",
      success: "text-success-700 dark:text-success-400",
      progress: "text-primary-700 dark:text-primary-400",
      warning: "text-warning-700 dark:text-warning-400",
      error: "text-destructive dark:text-destructive/90",
      neutral: "text-muted-foreground",
      unknown: "text-muted-foreground",
    },
    size: {
      sm: "text-xs",
      md: "text-sm",
      lg: "text-base",
    },
  },
  defaultVariants: {
    size: "md",
  },
});

export interface StatusIndicatorProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof indicatorVariants> {
  /**
   * The status value to display. Accepts known status types from the Forge platform.
   * For custom values, use type assertion: `<StatusIndicator status="custom" as any />`
   */
  status:
    | DeploymentStatus
    | ServiceStatus
    | HealthStatus
    | JobEntityStatus
    | DockerContainerStatus
    | LogLevel;

  /**
   * Whether to display the text label alongside the indicator dot.
   * @default true
   */
  showLabel?: boolean;

  /**
   * Custom label to override the default status label.
   * If provided, this will be used instead of the mapped label.
   */
  label?: string;

  /**
   * Whether to show a pulse animation for active/in-progress states.
   * @default true
   */
  animated?: boolean;

  /**
   * Size of the indicator and label text.
   * @default "md"
   */
  size?: "sm" | "md" | "lg";
}

/**
 * StatusIndicator component for displaying status information with visual indicators.
 *
 * This component automatically maps known status types to appropriate colors and labels,
 * providing a consistent visual language across the application.
 *
 * @example
 * ```tsx
 * <StatusIndicator status="running" />
 * <StatusIndicator status="failed" size="sm" showLabel={false} />
 * <StatusIndicator status="building" label="Custom label" />
 * ```
 */
function StatusIndicator({
  status,
  showLabel = true,
  label: customLabel,
  animated = true,
  size = "md",
  className,
  ...props
}: StatusIndicatorProps): React.ReactElement {
  const category = getStatusCategory(status);
  const displayLabel = customLabel ?? getStatusLabel(status);

  return (
    <div
      className={cn(indicatorVariants({ size }), className)}
      role="status"
      aria-label={`Status: ${displayLabel}`}
      {...props}
    >
      <span className={dotVariants({ category, size, animated })} />
      {showLabel && <span className={labelVariants({ category, size })}>{displayLabel}</span>}
    </div>
  );
}

export { StatusIndicator, indicatorVariants, labelVariants, dotVariants };
