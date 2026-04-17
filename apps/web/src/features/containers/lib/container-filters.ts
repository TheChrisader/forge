import type { DockerContainer } from "@forge/types";

/**
 * Set of Docker statuses that indicate the container is no longer live.
 * These are mapped to TERMINATED or STOPPED in the DB status model.
 */
const TERMINATED_DOCKER_STATUSES = new Set(["dead", "exited"]);

/**
 * Set of DB-level statuses that indicate the container is inactive.
 */
const TERMINATED_DB_STATUSES = new Set(["TERMINATED", "STOPPED"]);

/**
 * Maps a Docker container status string to the canonical DB-level status.
 * Used across both the project containers tab and standalone containers page.
 */
export function mapDockerStatusToDbStatus(
  dockerStatus: string
):
  | "RUNNING"
  | "STOPPED"
  | "CREATING"
  | "STARTING"
  | "STOPPING"
  | "RESTARTING"
  | "ERROR"
  | "TERMINATED" {
  const statusMap: Record<
    string,
    | "RUNNING"
    | "STOPPED"
    | "CREATING"
    | "STARTING"
    | "STOPPING"
    | "RESTARTING"
    | "ERROR"
    | "TERMINATED"
  > = {
    running: "RUNNING",
    exited: "STOPPED",
    created: "CREATING",
    paused: "STOPPED",
    restarting: "RESTARTING",
    removing: "STOPPING",
    dead: "TERMINATED",
  };
  return statusMap[dockerStatus] ?? "ERROR";
}

/**
 * Returns true if the container's Docker status indicates it is terminated/stopped.
 */
export function isTerminatedDockerStatus(dockerStatus: string): boolean {
  return TERMINATED_DOCKER_STATUSES.has(dockerStatus);
}

/**
 * Returns true if the DB-level status indicates the container is inactive.
 */
export function isTerminatedDbStatus(dbStatus: string): boolean {
  return TERMINATED_DB_STATUSES.has(dbStatus);
}

/**
 * Splits containers into active and terminated groups based on Docker status.
 */
export function partitionContainersByStatus(containers: DockerContainer[]): {
  active: DockerContainer[];
  terminated: DockerContainer[];
} {
  const active: DockerContainer[] = [];
  const terminated: DockerContainer[] = [];

  for (const container of containers) {
    if (isTerminatedDockerStatus(container.status)) {
      terminated.push(container);
    } else {
      active.push(container);
    }
  }

  return { active, terminated };
}

/**
 * Returns a Tailwind background color class for the status bar indicator.
 */
export function getStatusBarColor(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "running" || normalized === "healthy") return "bg-primary";
  if (normalized === "exited" || normalized === "stopped" || normalized === "dead")
    return "bg-muted-foreground";
  if (normalized === "restarting") return "bg-secondary";
  return "bg-destructive";
}
