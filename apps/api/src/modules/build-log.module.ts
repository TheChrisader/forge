import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import type { PrismaClient } from "@forge/database";
import { BuildLogService } from "@forge/core";
import { QueueService } from "@forge/queue";
import { SSEManagerService } from "../services/sse-manager.service.js";

interface DeploymentLogProgress {
  type: "deployment.log";
  deploymentId: string;
  data: {
    lineNumber: number;
    timestamp: string;
    level: string;
    source: string;
    message: string;
    stage?: string;
    progress?: number;
  };
}

export class BuildLogModule implements ServiceModule {
  private sseManager?: SSEManagerService;

  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.LOG_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new BuildLogService(db);
    });

    this.sseManager = container.resolveSync<SSEManagerService>(SERVICE_KEY_STRINGS.SSE_MANAGER);

    const queueService = container.resolveSync<QueueService>(SERVICE_KEY_STRINGS.QUEUE);
    const buildQueue = queueService.getQueue("build");
    const deployQueue = queueService.getQueue("deploy");

    queueService.onProgress("build", (...args: unknown[]) => {
      // BullMQ v5 passes { jobId: string, data: JobProgress } as first arg
      const eventArgs = args[0] as { jobId: string; data: unknown } | undefined;
      const progress = eventArgs?.data;

      if (
        progress &&
        typeof progress === "object" &&
        "type" in progress &&
        progress.type === "deployment.log"
      ) {
        const deploymentLog = progress as DeploymentLogProgress;

        this.sseManager?.publish(`deployment:${deploymentLog.deploymentId}`, {
          id: String(deploymentLog.data.lineNumber),
          event: "log",
          data: deploymentLog.data,
        });
      }
    });

    queueService.onProgress("deploy", (...args: unknown[]) => {
      // BullMQ v5 passes { jobId: string, data: JobProgress } as first arg
      const eventArgs = args[0] as { jobId: string; data: unknown } | undefined;
      const progress = eventArgs?.data;

      if (
        progress &&
        typeof progress === "object" &&
        "type" in progress &&
        progress.type === "deployment.log"
      ) {
        const deploymentLog = progress as DeploymentLogProgress;

        this.sseManager?.publish(`deployment:${deploymentLog.deploymentId}`, {
          id: String(deploymentLog.data.lineNumber),
          event: "log",
          data: deploymentLog.data,
        });
      }
    });

    queueService.onCompleted("build", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; returnvalue: string } | undefined;
      if (!eventArgs) return;

      void (async (): Promise<void> => {
        try {
          const job = await buildQueue.getJob(eventArgs.jobId);

          if (job?.data && typeof job.data === "object" && "deploymentId" in job.data) {
            const jobData = job.data as Record<string, unknown>;
            const deploymentId = jobData.deploymentId as string;
            this.sseManager?.publish(`deployment:${deploymentId}`, {
              event: "completed",
              data: { status: "SUCCEEDED" },
            });
          }
        } catch (error) {
          console.error(`Failed to fetch job ${eventArgs.jobId} on completion:`, error);
        }
      })();
    });

    queueService.onFailed("build", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; failedReason: string } | undefined;
      if (!eventArgs) return;

      void (async (): Promise<void> => {
        try {
          const job = await buildQueue.getJob(eventArgs.jobId);

          if (job?.data && typeof job.data === "object" && "deploymentId" in job.data) {
            const jobData = job.data as Record<string, unknown>;
            const deploymentId = jobData.deploymentId as string;
            this.sseManager?.publish(`deployment:${deploymentId}`, {
              event: "error",
              data: {
                message: eventArgs.failedReason || "Build failed",
              },
            });
          }
        } catch (error) {
          console.error(`Failed to fetch job ${eventArgs.jobId} on failure:`, error);
        }
      })();
    });

    queueService.onCompleted("deploy", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; returnvalue: string } | undefined;
      if (!eventArgs) return;

      void (async (): Promise<void> => {
        try {
          const job = await deployQueue.getJob(eventArgs.jobId);

          if (job?.data && typeof job.data === "object" && "deploymentId" in job.data) {
            const jobData = job.data as Record<string, unknown>;
            const deploymentId = jobData.deploymentId as string;
            this.sseManager?.publish(`deployment:${deploymentId}`, {
              event: "completed",
              data: { status: "SUCCEEDED" },
            });
          }
        } catch (error) {
          console.error(`Failed to fetch job ${eventArgs.jobId} on completion:`, error);
        }
      })();
    });

    queueService.onFailed("deploy", (...args: unknown[]) => {
      const eventArgs = args[0] as { jobId: string; failedReason: string } | undefined;
      if (!eventArgs) return;

      void (async (): Promise<void> => {
        try {
          const job = await deployQueue.getJob(eventArgs.jobId);

          if (job?.data && typeof job.data === "object" && "deploymentId" in job.data) {
            const jobData = job.data as Record<string, unknown>;
            const deploymentId = jobData.deploymentId as string;
            this.sseManager?.publish(`deployment:${deploymentId}`, {
              event: "error",
              data: {
                message: eventArgs.failedReason || "Deployment failed",
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
