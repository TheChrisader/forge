export const QUEUE_NAMES = {
  BUILD: "build",
  DEPLOY: "deploy",
  JOBS: "jobs",
  WEBHOOKS: "webhooks",
  NOTIFICATIONS: "notifications",
  SERVICES: "services",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];
