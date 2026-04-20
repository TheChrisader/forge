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
  name: "service-deprovision-handler",
});

export async function handleDeprovision(
  context: IJobContext<ServiceJobData>,
  runtime: IContainerRuntime
): Promise<void> {
  const { serviceId, projectId } = context.job.data;
  const db = getDatabaseClient();

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) {
    logger.warn("Service not found for deprovision (may already be deleted)", { serviceId });
    return;
  }

  // Collect affected projects before deprovisioning deletes the service and its links
  const affectedProjects = [projectId];

  if (service.isShared) {
    const linkedProjects = await db.serviceProjectAccess.findMany({
      where: { serviceId },
      select: { projectId: true },
    });
    affectedProjects.push(...linkedProjects.map((lp) => lp.projectId));
  }

  const provisioner = new ServiceProvisioner(runtime, db);
  await provisioner.deprovision(service);

  await emitServiceStatus(context, "DEPROVISIONED");

  // Notify affected projects that the service has been removed
  for (const pid of affectedProjects) {
    await context.updateProgress({
      type: "service.project_notification",
      serviceId,
      projectId: pid,
      event: "project:service-removed",
      data: {
        serviceId,
        serviceName: service.name,
        message: `Service "${service.name}" has been removed. Redeploy to update connection variables.`,
      },
    });
  }
}
