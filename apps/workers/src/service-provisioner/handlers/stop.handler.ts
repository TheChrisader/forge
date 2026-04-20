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
  name: "service-stop-handler",
});

export async function handleStop(
  context: IJobContext<ServiceJobData>,
  runtime: IContainerRuntime
): Promise<void> {
  const { serviceId } = context.job.data;
  const db = getDatabaseClient();

  const service = await db.service.findUnique({ where: { id: serviceId } });
  if (!service) throw new Error(`Service ${serviceId} not found`);

  const provisioner = new ServiceProvisioner(runtime, db);

  try {
    await provisioner.stop(service);
    await emitServiceStatus(context, "STOPPED");
  } catch (err) {
    logger.error("Stop failed", { serviceId, err });
    await db.service.update({
      where: { id: serviceId },
      data: { status: "ERROR" },
    });
    await emitServiceStatus(context, "ERROR");
    throw err;
  }
}
