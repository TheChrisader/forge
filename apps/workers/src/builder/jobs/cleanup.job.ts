/**
 * Automated image cleanup job
 *
 * Runs daily at 2 AM to prune old images for all active projects
 */

import { CronJob } from "cron";
import type { PrismaClient } from "@forge/database";
import { SERVICE_KEY_STRINGS, type ServiceContainer } from "@forge/core";
import { DockerRuntime } from "@forge/docker";
import { generateImageTagPrefix } from "@forge/build";
import type { LogLevel } from "@forge/core";
import { LoggerService } from "@forge/logger";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "cleanup-job",
});

export function startCleanupJob(container: ServiceContainer): void {
  const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
  const runtime = new DockerRuntime();

  // Run daily at 2 AM
  const job = new CronJob("0 2 * * *", async () => {
    logger.info("Running automated image cleanup...", { event: "automated_image_cleanup_start" });

    try {
      // Get all active projects
      const projects = await db.project.findMany({
        where: { status: "ACTIVE", deletedAt: null },
      });

      let totalDeleted = 0;
      let totalReclaimed = 0;

      for (const project of projects) {
        try {
          // Prune images older than 30 days for each project
          const result = await runtime.pruneOldImages(generateImageTagPrefix(project.name), 30);

          if (result.deleted.length > 0) {
            logger.info(
              `Pruned ${result.deleted.length} images for ${project.name} (${project.id})`,
              {
                event: "pruned_project_images",
                projectId: project.id,
                projectName: project.name,
                deleted: result.deleted.length,
                freedBytes: result.reclaimedBytes,
              }
            );
            totalDeleted += result.deleted.length;
            totalReclaimed += result.reclaimedBytes;
          }

          if (result.errors?.length > 0) {
            logger.warn(`Errors pruning images for ${project.name}`, {
              event: "prune_errors",
              projectId: project.id,
              projectName: project.name,
              errors: result.errors,
            });
          }
        } catch (err) {
          logger.error(`Failed to prune images for project ${project.id}`, {
            event: "prune_project_failed",
            projectId: project.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }

      // Prune dangling images
      const dangling = await runtime.pruneDanglingImages();
      logger.info("Pruned dangling images", {
        event: "pruned_dangling_images",
        deleted: dangling.deleted.length,
        reclaimedBytes: dangling.reclaimedBytes,
      });
      totalDeleted += dangling.deleted.length;
      totalReclaimed += dangling.reclaimedBytes;

      try {
        const cacheVolumes = await runtime.listVolumes({ name: ["forge-nixpacks-cache"] });
        if (cacheVolumes.length > 0) {
          logger.info("Nixpacks cache volume present", {
            event: "nixpacks_cache_volume_ok",
            volumeName: cacheVolumes[0].name,
            labels: cacheVolumes[0].labels,
          });
        }
      } catch (volErr) {
        logger.warn("Could not check nixpacks cache volume", {
          event: "nixpacks_cache_volume_check_failed",
          error: volErr instanceof Error ? volErr.message : String(volErr),
        });
      }

      logger.info("Image cleanup completed", {
        event: "cleanup_completed",
        totalDeleted,
        totalReclaimedBytes: totalReclaimed,
      });
    } catch (error) {
      logger.error("Image cleanup job failed", {
        event: "cleanup_failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });

  job.start();
  logger.info("Cleanup job scheduled (daily at 2 AM)");
}
