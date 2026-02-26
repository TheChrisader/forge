/**
 * Queue Job type definitions
 * Defines data structures for jobs that can be queued and processed
 */

import type { ProjectSourceType } from "./enums";

export interface BuildJobData {
  deploymentId: string;
  projectId: string;
  version: string;

  sourceType?: ProjectSourceType;

  gitUrl?: string;
  branch?: string;
  gitCommit?: string;

  localPath?: string;

  imageUrl?: string;

  buildArgs?: Record<string, string>;
  noCache?: boolean;
}

export interface DeployJobData {
  deploymentId: string;
  projectId: string;
  image: string;
  strategy?: "rolling" | "blue-green" | "canary";
  replicas?: number;
  healthCheck?: {
    path: string;
    interval: string;
    timeout: string;
    retries: number;
  };
}

export interface ScheduledJobData {
  jobId: string;
  projectId: string;
  command: string;
  env?: Record<string, string>;
  workingDir?: string;
}

export interface WebhookJobData {
  webhookId: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
  retries?: number;
}

export interface NotificationJobData {
  channel: "slack" | "discord" | "email" | "webhook";
  message: string;
  metadata?: Record<string, unknown>;
}

export interface BuildJobResult {
  success: boolean;
  image?: string;
  logs: string;
  duration?: number;
  error?: string;
}

export interface DeployJobResult {
  success: boolean;
  containerIds: string[];
  duration?: number;
  error?: string;
}

export interface JobResult {
  success: boolean;
  output?: string;
  exitCode?: number;
  duration?: number;
  error?: string;
}

export interface JobOptions {
  priority?: number;
  delay?: number;
  attempts?: number;
  backoff?: BackoffOptions;
  removeOnComplete?: boolean | number;
  removeOnFail?: boolean | number;
  timeout?: number;
}

export interface BackoffOptions {
  type: "fixed" | "exponential";
  delay: number;
}

export type JobStatus = "waiting" | "active" | "completed" | "failed" | "delayed" | "paused";

export interface JobInfo<T = unknown> {
  id: string;
  name: string;
  data: T;
  opts: JobOptions;
  progress: number;
  attemptsMade: number;
  processedOn?: number;
  finishedOn?: number;
  timestamp: number;
  failedReason?: string;
  stacktrace?: string[];
  returnvalue?: unknown;
}
