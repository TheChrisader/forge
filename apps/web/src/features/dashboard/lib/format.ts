import { formatDistanceToNow } from "date-fns";

export function formatRelativeTime(timestamp: string): string {
  return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
}

const RESOURCE_NAMES: Record<string, string> = {
  deployments: "Deployment",
  containers: "Container",
  projects: "Project",
  services: "Service",
  secrets: "Secret",
  domains: "Domain",
  images: "Image",
};

const VERB_NAMES: Record<string, string> = {
  create: "created",
  update: "updated",
  delete: "deleted",
  deploy: "deployed",
  start: "started",
  stop: "stopped",
  restart: "restarted",
  cancel: "cancelled",
};

export function formatAuditAction(action: string): string {
  const dotIndex = action.indexOf(".");
  if (dotIndex === -1) return action;

  const resource = action.slice(0, dotIndex);
  const verb = action.slice(dotIndex + 1);

  const resourceName = RESOURCE_NAMES[resource] ?? resource;
  const verbName = VERB_NAMES[verb] ?? verb;

  return `${resourceName} ${verbName}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(1)} ${units[i]}`;
}
