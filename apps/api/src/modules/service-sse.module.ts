import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { QueueService } from "@forge/queue";
import { SSEManagerService } from "../services/sse-manager.service.js";

interface ServiceStatusProgress {
  type: "service.status";
  serviceId: string;
  status: string;
}

interface ServiceProjectNotification {
  type: "service.project_notification";
  serviceId: string;
  projectId: string;
  event: string;
  data: Record<string, unknown>;
}

/**
 * ServiceSSEModule — Bridges BullMQ service queue events to SSE.
 *
 * Workers emit structured progress events via context.updateProgress().
 * This module listens for those events and publishes them to connected
 * SSE clients on the `services` (global) and `service:{id}` (per-service) topics.
 */
export class ServiceSSEModule implements ServiceModule {
  private sseManager?: SSEManagerService;

  register(container: ServiceContainer): void {
    this.sseManager = container.resolveSync<SSEManagerService>(SERVICE_KEY_STRINGS.SSE_MANAGER);

    const queueService = container.resolveSync<QueueService>(SERVICE_KEY_STRINGS.QUEUE);
    const servicesQueue = queueService.getQueue("services");

    queueService.onProgress("services", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; data: unknown } | undefined;
      const progress = eventArgs?.data;

      if (
        progress &&
        typeof progress === "object" &&
        "type" in progress &&
        progress.type === "service.status"
      ) {
        const statusEvent = progress as ServiceStatusProgress;
        const { serviceId, status } = statusEvent;

        this.sseManager?.publish(`service:${serviceId}`, {
          event: `service:${status.toLowerCase()}`,
          data: { serviceId, status },
        });

        this.sseManager?.publish("services", {
          event: "service:status_changed",
          data: { serviceId, status },
        });
      }

      if (
        progress &&
        typeof progress === "object" &&
        "type" in progress &&
        progress.type === "service.project_notification"
      ) {
        const notification = progress as ServiceProjectNotification;
        this.sseManager?.publish(`project:${notification.projectId}`, {
          event: notification.event,
          data: notification.data,
        });
      }
    });

    queueService.onCompleted("services", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; returnvalue: string } | undefined;
      if (!eventArgs) return;

      void (async (): Promise<void> => {
        try {
          const job = await servicesQueue.getJob(eventArgs.jobId);

          if (job?.data && typeof job.data === "object" && "serviceId" in job.data) {
            const jobData = job.data as Record<string, unknown>;
            const serviceId = jobData.serviceId as string;

            this.sseManager?.publish(`service:${serviceId}`, {
              event: "service:job_completed",
              data: { serviceId, jobId: eventArgs.jobId },
            });
          }
        } catch (error) {
          console.error(`Failed to fetch job ${eventArgs.jobId} on completion:`, error);
        }
      })();
    });

    queueService.onFailed("services", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; failedReason: string } | undefined;
      if (!eventArgs) return;

      void (async (): Promise<void> => {
        try {
          const job = await servicesQueue.getJob(eventArgs.jobId);

          if (job?.data && typeof job.data === "object" && "serviceId" in job.data) {
            const jobData = job.data as Record<string, unknown>;
            const serviceId = jobData.serviceId as string;

            this.sseManager?.publish(`service:${serviceId}`, {
              event: "service:error",
              data: {
                serviceId,
                message: eventArgs.failedReason || "Service job failed",
              },
            });

            this.sseManager?.publish("services", {
              event: "service:error",
              data: {
                serviceId,
                message: eventArgs.failedReason || "Service job failed",
              },
            });
          }
        } catch (error) {
          console.error(`Failed to fetch job ${eventArgs.jobId} on failure:`, error);
        }
      })();
    });
  }
}
