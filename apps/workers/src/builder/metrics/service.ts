import type { PrismaClient } from "@forge/database";
import type { DeploymentStatus } from "@forge/types";
import type { MetricsCollector } from "@forge/observability";

export interface BuildMetricsRecord {
  deploymentId: string;
  projectId: string;
  startedAt: Date;
  completedAt?: Date;
  status: DeploymentStatus;
  imageSize?: number;
  errorMessage?: string;
}

export interface BuildStatistics {
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  successRate: number;
  averageBuildDuration: number;
}

export class BuildMetricsService {
  constructor(
    private readonly db: PrismaClient,
    private readonly metricsCollector?: MetricsCollector
  ) {}

  async recordBuildStart(deploymentId: string): Promise<void> {
    await this.db.deployment.update({
      where: { id: deploymentId },
      data: { buildStartedAt: new Date() },
    });
  }

  /**
   * Record the completion of a build
   *
   * Note: Build metrics are stored in the Deployment table (buildStartedAt, buildCompletedAt).
   * The DeploymentMetrics table is for runtime metrics (requestCount, errorCount, bandwidth)
   * collected by the observer worker, not the build worker.
   */
  async recordBuildComplete(record: BuildMetricsRecord): Promise<void> {
    await this.db.deployment.update({
      where: { id: record.deploymentId },
      data: {
        status: record.status,
        buildCompletedAt: record.completedAt ?? new Date(),
        error: record.errorMessage,
        ...(record.imageSize ? { buildImage: `forge:${record.deploymentId}` } : {}),
      },
    });

    if (!this.metricsCollector) return;

    const completedAt = record.completedAt ?? new Date();
    const durationSeconds = (completedAt.getTime() - record.startedAt.getTime()) / 1000;

    this.metricsCollector.record({
      sourceType: "BUILD",
      sourceId: record.deploymentId,
      sourceName: "Build",
      metric: "build_total",
      value: 1,
      unit: "count",
      projectId: record.projectId,
      deploymentId: record.deploymentId,
    });

    this.metricsCollector.record({
      sourceType: "BUILD",
      sourceId: record.deploymentId,
      sourceName: "Build",
      metric: "build_duration_seconds",
      value: durationSeconds,
      unit: "seconds",
      projectId: record.projectId,
      deploymentId: record.deploymentId,
    });

    if (record.status === "FAILED") {
      this.metricsCollector.record({
        sourceType: "BUILD",
        sourceId: record.deploymentId,
        sourceName: "Build",
        metric: "build_errors_total",
        value: 1,
        unit: "count",
        projectId: record.projectId,
        deploymentId: record.deploymentId,
      });
    }
  }

  async getProjectStatistics(projectId: string): Promise<BuildStatistics> {
    const deployments = await this.db.deployment.findMany({
      where: {
        projectId,
        status: { in: ["SUCCEEDED", "FAILED"] },
      },
      select: {
        status: true,
        buildStartedAt: true,
        buildCompletedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 100, // Last 100 builds
    });

    const totalBuilds = deployments.length;
    const successfulBuilds = deployments.filter((d) => d.status === "SUCCEEDED").length;
    const failedBuilds = deployments.filter((d) => d.status === "FAILED").length;

    const successfulWithTiming = deployments.filter(
      (d) => d.status === "SUCCEEDED" && d.buildStartedAt && d.buildCompletedAt
    );

    const averageBuildDuration =
      successfulWithTiming.length > 0
        ? successfulWithTiming.reduce(
            (sum, d) => sum + (d.buildCompletedAt!.getTime() - d.buildStartedAt!.getTime()),
            0
          ) / successfulWithTiming.length
        : 0;

    return {
      totalBuilds,
      successfulBuilds,
      failedBuilds,
      successRate: totalBuilds > 0 ? (successfulBuilds / totalBuilds) * 100 : 0,
      averageBuildDuration,
    };
  }
}
