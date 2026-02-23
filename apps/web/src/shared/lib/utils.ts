import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProjectStatus, ServiceStatus } from "@forge/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Maps ProjectStatus to ServiceStatus for StatusIndicator component
 */
export function mapProjectStatusToServiceStatus(status: ProjectStatus): ServiceStatus {
  switch (status) {
    case "ACTIVE":
      return "RUNNING";
    case "INACTIVE":
      return "STOPPED";
    case "ARCHIVED":
      return "STOPPED";
    default:
      return "ERROR";
  }
}
