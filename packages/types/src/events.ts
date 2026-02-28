export type EventType =
  | "deployment.started"
  | "deployment.progress"
  | "deployment.completed"
  | "deployment.failed"
  | "container.created"
  | "container.started"
  | "container.stopped"
  | "container.removed"
  | "log.entry"
  | "metric.data"
  | "health.check";

export interface BaseEvent {
  type: EventType;
  timestamp: string;
  data: unknown;
}

export interface DeploymentEvent extends BaseEvent {
  type: "deployment.started" | "deployment.progress" | "deployment.completed" | "deployment.failed";
  data: {
    deploymentId: string;
    projectId: string;
    status: string;
    progress?: number;
    message?: string;
    error?: string;
  };
}

export interface LogEvent extends BaseEvent {
  type: "log.entry";
  data: {
    sourceId: string;
    sourceType: string;
    level: string;
    message: string;
    timestamp: string;
  };
}

export type ForgeEvent = DeploymentEvent | LogEvent | BaseEvent;

/**
 * SSE deployment log event data structure
 * This represents a single log line from the build process
 */
export interface SSEDeploymentLogData {
  lineNumber: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  stage?: string;
  progress?: number;
}

/**
 * SSE deployment completion event data
 */
export interface SSEDeploymentCompletedData {
  status: "SUCCEEDED";
}

/**
 * SSE deployment error event data
 */
export interface SSEDeploymentErrorData {
  message: string;
}
