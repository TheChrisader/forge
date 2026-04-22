import type { IContainerRuntime } from "@forge/docker";
import type { PrismaClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "orphan-detector",
});

const SOFT_DELETE_GRACE_PERIOD_MS = 24 * 60 * 60 * 1000;

export interface OrphanedResource {
  name: string;
  serviceId: string;
  type: "container" | "volume";
}

export interface OrphanDetectionResult {
  orphanedContainers: OrphanedResource[];
  orphanedVolumes: OrphanedResource[];
}

export class OrphanDetector {
  constructor(
    private readonly runtime: IContainerRuntime,
    private readonly db: PrismaClient
  ) {}

  async findOrphanedResources(): Promise<OrphanDetectionResult> {
    const orphanedContainers: OrphanedResource[] = [];
    const orphanedVolumes: OrphanedResource[] = [];

    const containers = await this.runtime.list({
      label: { "forge.service": "true" },
    });

    for (const container of containers) {
      const serviceId = container.labels?.["forge.serviceId"];
      if (!serviceId) continue;

      const isOrphaned = await this.isServiceOrphaned(serviceId);
      if (isOrphaned) {
        orphanedContainers.push({
          name: container.name ?? container.id,
          serviceId,
          type: "container",
        });
      }
    }

    // Find orphaned volumes by listing all and filtering for Forge-managed ones
    const allVolumes = await this.runtime.listVolumes();
    const serviceVolumes = allVolumes.filter(
      (v) => v.labels?.["forge.serviceId"] || v.name?.startsWith("forge-svc-data-")
    );

    for (const volume of serviceVolumes) {
      const serviceId =
        volume.labels?.["forge.serviceId"] ?? this.extractServiceIdFromVolumeName(volume.name);
      if (!serviceId) continue;

      const isOrphaned = await this.isServiceOrphaned(serviceId);
      if (isOrphaned) {
        orphanedVolumes.push({
          name: volume.name,
          serviceId,
          type: "volume",
        });
      }
    }

    if (orphanedContainers.length > 0 || orphanedVolumes.length > 0) {
      logger.info("Detected orphaned resources", {
        containers: orphanedContainers.length,
        volumes: orphanedVolumes.length,
      });
    }

    return { orphanedContainers, orphanedVolumes };
  }

  async cleanupOrphans(): Promise<{ cleanedContainers: number; cleanedVolumes: number }> {
    const { orphanedContainers, orphanedVolumes } = await this.findOrphanedResources();

    let cleanedContainers = 0;
    for (const orphan of orphanedContainers) {
      try {
        const container = await this.runtime.inspect(orphan.name);
        if (container.state?.running) {
          await this.runtime.stop(orphan.name, { timeout: 10 });
        }
        await this.runtime.remove(orphan.name, { force: true });
        cleanedContainers++;
        logger.info("Cleaned up orphaned container", {
          name: orphan.name,
          serviceId: orphan.serviceId,
        });
      } catch (err) {
        logger.error("Failed to clean up orphaned container", {
          name: orphan.name,
          serviceId: orphan.serviceId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    let cleanedVolumes = 0;
    for (const orphan of orphanedVolumes) {
      try {
        await this.runtime.removeVolume(orphan.name);
        cleanedVolumes++;
        logger.info("Cleaned up orphaned volume", {
          name: orphan.name,
          serviceId: orphan.serviceId,
        });
      } catch (err) {
        logger.error("Failed to clean up orphaned volume", {
          name: orphan.name,
          serviceId: orphan.serviceId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return { cleanedContainers, cleanedVolumes };
  }

  private async isServiceOrphaned(serviceId: string): Promise<boolean> {
    const service = await this.db.service.findUnique({
      where: { id: serviceId },
      select: { deletedAt: true },
    });

    // No record at all — orphaned
    if (!service) return true;

    // Soft-deleted within grace period — not yet orphaned
    if (service.deletedAt) {
      const elapsed = Date.now() - service.deletedAt.getTime();
      return elapsed > SOFT_DELETE_GRACE_PERIOD_MS;
    }

    // Active service — not orphaned
    return false;
  }

  private extractServiceIdFromVolumeName(volumeName?: string): string | null {
    if (!volumeName) return null;
    const match = volumeName.match(/^forge-svc-data-([a-f0-9]{8})/);
    return match ? match[1] : null;
  }
}
