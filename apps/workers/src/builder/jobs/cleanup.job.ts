/**
 * Automated image cleanup job
 *
 * Runs daily at 2 AM to prune old images for all active projects
 */

import { CronJob } from "cron";
import type { PrismaClient } from "@forge/database";
import { SERVICE_KEY_STRINGS, type ServiceContainer } from "@forge/core";
import { DockerRuntime } from "@forge/docker";
import pino from "pino";

const logger = pino({ name: "cleanup-job" });

export function startCleanupJob(container: ServiceContainer): void {
  const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
  const runtime = new DockerRuntime();

  // Run daily at 2 AM
  const job = new CronJob("0 2 * * *", async () => {
    logger.info({ event: "automated_image_cleanup_start" }, "Running automated image cleanup...");

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
          const result = await runtime.pruneOldImages(`forge/${project.id}:`, 30);

          if (result.deleted.length > 0) {
            logger.info(
              {
                event: "pruned_project_images",
                projectId: project.id,
                projectName: project.name,
                deleted: result.deleted.length,
                freedBytes: result.reclaimedBytes,
              },
              `Pruned ${result.deleted.length} images for ${project.name} (${project.id})`
            );
            totalDeleted += result.deleted.length;
            totalReclaimed += result.reclaimedBytes;
          }

          if (result.errors?.length > 0) {
            logger.warn(
              {
                event: "prune_errors",
                projectId: project.id,
                projectName: project.name,
                errors: result.errors,
              },
              `Errors pruning images for ${project.name}`
            );
          }
        } catch (err) {
          logger.error(
            {
              event: "prune_project_failed",
              projectId: project.id,
              error: err instanceof Error ? err.message : String(err),
            },
            `Failed to prune images for project ${project.id}`
          );
        }
      }

      // Prune dangling images
      const dangling = await runtime.pruneDanglingImages();
      logger.info(
        {
          event: "pruned_dangling_images",
          deleted: dangling.deleted.length,
          reclaimedBytes: dangling.reclaimedBytes,
        },
        "Pruned dangling images"
      );
      totalDeleted += dangling.deleted.length;
      totalReclaimed += dangling.reclaimedBytes;

      logger.info(
        {
          event: "cleanup_completed",
          totalDeleted,
          totalReclaimedBytes: totalReclaimed,
        },
        "Image cleanup completed"
      );
    } catch (error) {
      logger.error(
        {
          event: "cleanup_failed",
          error: error instanceof Error ? error.message : String(error),
        },
        "Image cleanup job failed"
      );
    }
  });

  job.start();
  logger.info("Cleanup job scheduled (daily at 2 AM)");
}
