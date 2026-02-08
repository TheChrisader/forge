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
