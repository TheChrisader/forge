/**
 * Workers package entry point
 *
 * This package contains all Forge workers:
 * - builder: Processes build jobs from the queue
 * - deployer: Handles deployment operations
 * - service-provisioner: Manages service container lifecycle
 * - observer: Monitors deployment health (TODO)
 * - scheduler: Runs recurring maintenance tasks (TODO)
 */

export { BuildWorker, type BuildWorkerOptions } from "./builder/worker.js";
export { handleBuildJob } from "./builder/handlers/build.handler.js";

export { DeployerWorker, type DeployerWorkerOptions } from "./deployer/worker.js";
export { handleDeployJob } from "./deployer/handlers/deploy.handler.js";

export {
  ServiceProvisionerWorker,
  type ServiceProvisionerWorkerOptions,
} from "./service-provisioner/worker.js";
export { handleProvision } from "./service-provisioner/handlers/provision.handler.js";
export { ServiceHealthMonitor } from "./service-health-monitor.js";
export { BackupScheduler } from "./backup-scheduler.js";

export { NotificationWorker, type NotificationWorkerOptions } from "./notifier/worker.js";
export { handleNotifyJob } from "./notifier/handlers/notify.handler.js";
export { NotificationDispatcher } from "./notifier/dispatcher.js";
export { NotificationRateLimiter } from "./notifier/rate-limiter.js";
