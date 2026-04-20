import type { IJobContext } from "@forge/queue";
import type { ServiceJobData } from "@forge/service-catalog";

/**
 * Emit a service status change event via BullMQ progress.
 * Picked up by ServiceSSEModule on the API side and published to SSE clients.
 */
export async function emitServiceStatus(
  context: IJobContext<ServiceJobData>,
  status: string
): Promise<void> {
  await context.updateProgress({
    type: "service.status",
    serviceId: context.job.data.serviceId,
    status,
  });
}
