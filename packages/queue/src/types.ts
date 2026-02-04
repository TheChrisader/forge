/**
 * Job data types for different queue categories.
 */

export interface BuildJobData {
  deploymentId: string;
  projectId: string;
  version: string;
  gitUrl?: string;
  branch?: string;
}

export interface DeployJobData {
  deploymentId: string;
  projectId: string;
  image: string;
  strategy?: "rolling" | "blue-green" | "canary";
}

export interface ScheduledJobData {
  jobId: string;
  projectId: string;
  command: string;
}

export interface WebhookJobData {
  webhookId: string;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: unknown;
}

export interface BuildJobResult {
  success: boolean;
  image?: string;
  logs: string;
  error?: string;
}

export interface DeployJobResult {
  success: boolean;
  containerIds: string[];
  error?: string;
}
