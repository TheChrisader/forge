import { getDatabaseClient } from "@forge/database";
import type { PrismaClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { QueueService, type QueueConfig } from "@forge/queue";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "backup-scheduler",
});

export class BackupScheduler {
  private db: PrismaClient;
  private queueService: QueueService;
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;
  private readonly checkIntervalMs: number;

  constructor(queueConfig: QueueConfig, options?: { checkIntervalMs?: number }) {
    this.db = getDatabaseClient();
    this.queueService = new QueueService(queueConfig);
    this.checkIntervalMs = options?.checkIntervalMs ?? 60_000;
  }

  start(): void {
    if (this.running) return;

    this.running = true;
    logger.info("Backup scheduler started", { checkIntervalMs: this.checkIntervalMs });

    // Run immediately, then on interval
    this.checkDueBackups().catch((err) => {
      logger.error("Initial backup check failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    });

    this.timer = setInterval(() => {
      this.checkDueBackups().catch((err) => {
        logger.error("Backup check cycle failed", {
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }, this.checkIntervalMs);
  }

  async stop(): Promise<void> {
    this.running = false;

    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    await this.queueService.close();
    logger.info("Backup scheduler stopped");
  }

  private async checkDueBackups(): Promise<void> {
    const services = await this.db.service.findMany({
      where: {
        autoBackupSchedule: { not: null },
        deletedAt: null,
        status: { in: ["RUNNING", "HEALTHY"] },
        containerId: { not: null },
      },
      select: {
        id: true,
        projectId: true,
        autoBackupSchedule: true,
        autoBackupRetention: true,
      },
    });

    for (const service of services) {
      try {
        await this.checkServiceDue(service);
      } catch (err) {
        logger.error("Failed to check backup schedule for service", {
          serviceId: service.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  private async checkServiceDue(service: {
    id: string;
    projectId: string;
    autoBackupSchedule: string | null;
    autoBackupRetention: number | null;
  }): Promise<void> {
    if (!service.autoBackupSchedule) return;

    // Check if there's a pending or in-progress backup for this service
    const activeBackup = await this.db.serviceBackup.findFirst({
      where: {
        serviceId: service.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    });

    if (activeBackup) return;

    // Find the most recent completed scheduled backup
    const lastBackup = await this.db.serviceBackup.findFirst({
      where: {
        serviceId: service.id,
        type: "SCHEDULED",
        status: "COMPLETED",
      },
      orderBy: { createdAt: "desc" },
    });

    if (!isDueForBackup(service.autoBackupSchedule, lastBackup?.createdAt ?? null)) return;

    // Create backup record and enqueue job
    const backup = await this.db.serviceBackup.create({
      data: {
        serviceId: service.id,
        type: "SCHEDULED",
        path: "",
        size: BigInt(0),
        status: "PENDING",
      },
    });

    await this.queueService.addJob("services", `backup-${backup.id}`, {
      jobType: "BACKUP",
      serviceId: service.id,
      projectId: service.projectId,
      backupId: backup.id,
    });

    logger.info("Scheduled backup triggered", {
      serviceId: service.id,
      backupId: backup.id,
      schedule: service.autoBackupSchedule,
    });
  }
}

function isDueForBackup(schedule: string, lastBackupAt: Date | null): boolean {
  if (!lastBackupAt) return true;

  const now = Date.now();
  const last = lastBackupAt.getTime();

  switch (schedule) {
    case "daily":
      return now - last >= 24 * 60 * 60 * 1000;
    case "weekly":
      return now - last >= 7 * 24 * 60 * 60 * 1000;
    default:
      return false;
  }
}
