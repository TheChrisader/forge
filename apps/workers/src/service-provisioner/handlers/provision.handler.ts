import type { IJobContext } from "@forge/queue";
import type { IContainerRuntime } from "@forge/docker";
import type { ServiceJobData } from "@forge/service-catalog";
import { getDatabaseClient } from "@forge/database";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { ServiceProvisioner } from "../service-provisioner.js";
import { emitServiceStatus } from "../utils/emit-status.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "service-provision-handler",
});

export async function handleProvision(
  context: IJobContext<ServiceJobData>,
  runtime: IContainerRuntime
): Promise<void> {
  const { serviceId, projectId } = context.job.data;
  const db = getDatabaseClient();

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    throw new Error(`Service ${serviceId} not found`);
  }

  if (service.status !== "CREATING") {
    logger.warn("Service not in CREATING state, skipping provision", {
      serviceId,
      status: service.status,
    });
    return;
  }

  const provisioner = new ServiceProvisioner(runtime, db);

  try {
    await provisioner.provision(service);

    // Broadcast service status on the service channel
    await emitServiceStatus(context, "RUNNING");

    // Notify all affected projects so they know to redeploy
    const affectedProjects = [projectId];

    if (service.isShared) {
      const linkedProjects = await db.serviceProjectAccess.findMany({
        where: { serviceId },
        select: { projectId: true },
      });
      affectedProjects.push(...linkedProjects.map((lp) => lp.projectId));
    }

    for (const pid of affectedProjects) {
      await context.updateProgress({
        type: "service.project_notification",
        serviceId,
        projectId: pid,
        event: "project:service-available",
        data: {
          serviceId,
          serviceName: service.name,
          engine: service.engine,
          message: `Service "${service.name}" is now available. Redeploy to inject connection variables.`,
        },
      });
    }
  } catch (err) {
    logger.error("Provisioning failed", { serviceId, err });

    await db.service.update({
      where: { id: serviceId },
      data: {
        status: "ERROR",
        config: {
          ...(service.config as Record<string, unknown>),
          _error: err instanceof Error ? err.message : String(err),
        },
      },
    });

    await emitServiceStatus(context, "ERROR");
    throw err;
  }
}
