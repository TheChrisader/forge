import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ProjectStatus, ServiceStatus } from "@forge/types";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/**
 * Formats bytes to human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
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
