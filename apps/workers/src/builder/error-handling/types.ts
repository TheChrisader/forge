import type { DeploymentStatus } from "@forge/types";

export interface ErrorHandlingStrategy {
  readonly shouldRetry: boolean;
  readonly userMessage: string;
  readonly logLevel: "error" | "warn";
  readonly deploymentStatus: DeploymentStatus;
}

export interface ErrorHandlerContext {
  readonly deploymentId: string;
  readonly projectId: string;
  readonly operation: "git-clone" | "docker-build" | "framework-detect" | "unknown";
}
