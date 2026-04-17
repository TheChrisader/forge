import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import type { DockerRuntime } from "@forge/docker";
import { getDatabaseClient } from "@forge/database";
import { requireAuth } from "../middleware/auth.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { DashboardStatsResponseSchema } from "@forge/types";

export function registerDashboardRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const runtime = container.resolveSync<DockerRuntime>(SERVICE_KEY_STRINGS.CONTAINER_RUNTIME);

  server.get(
    "/api/dashboard/stats",
    {
      schema: {
        response: { 200: DashboardStatsResponseSchema },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);

      const db = getDatabaseClient();
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        projectCount,
        deploymentCount,
        containerCount,
        serviceCount,
        projectTrend,
        deploymentTrend,
        containerTrend,
        systemInfo,
        aggregatedStats,
        diskUsage,
      ] = await Promise.all([
        db.project.count({ where: { deletedAt: null } }),
        db.deployment.count({ where: { deletedAt: null } }),
        db.container.count({ where: { deletedAt: null } }),
        db.service.count(),
        db.project.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
        db.deployment.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
        db.container.count({ where: { deletedAt: null, createdAt: { gte: sevenDaysAgo } } }),
        runtime.getSystemInfo(),
        runtime.getAggregatedStats().catch(() => null),
        runtime.getDiskUsage().catch(() => null),
      ]);

      return reply.status(200).send({
        counts: {
          projects: projectCount,
          deployments: deploymentCount,
          containers: containerCount,
          services: serviceCount,
        },
        trends: {
          projects: projectTrend,
          deployments: deploymentTrend,
          containers: containerTrend,
        },
        system: {
          cpuCores: systemInfo.NCPU,
          memoryTotalBytes: systemInfo.MemTotal,
          containersRunning: systemInfo.ContainersRunning,
          containersTotal: systemInfo.Containers,
          cpuPercent: aggregatedStats?.cpuPercent ?? 0,
          memoryUsedBytes: aggregatedStats?.memoryUsedBytes ?? 0,
          storage: diskUsage ?? {
            imagesSizeBytes: 0,
            containersSizeBytes: 0,
            volumesSizeBytes: 0,
            totalSizeBytes: 0,
          },
        },
      });
    }
  );
}
