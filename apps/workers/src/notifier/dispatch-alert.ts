import type { AlertSeverity, AlertStatus, PrismaClient } from "@forge/database";
import { QueueService } from "@forge/queue";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { NotificationDispatcher } from "./dispatcher.js";
import type { NotificationRateLimiter } from "./rate-limiter.js";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "dispatch-alert",
});

interface CreateAlertData {
  ruleId: string;
  status: AlertStatus;
  severity: AlertSeverity;
  value: number;
  message: string;
}

export async function createAlertAndDispatch(
  db: PrismaClient,
  queueService: QueueService | null,
  rateLimiter: NotificationRateLimiter | null,
  alertData: CreateAlertData
): Promise<{ alertId: string }> {
  const alert = await db.alert.create({ data: alertData });

  if (queueService && rateLimiter) {
    const dispatcher = new NotificationDispatcher(db, queueService, rateLimiter);
    dispatcher.dispatchForAlert(alert.id).catch((err) => {
      logger.error("Failed to dispatch notifications for alert", {
        alertId: alert.id,
        error: err instanceof Error ? err.message : String(err),
      });
    });
  }

  return { alertId: alert.id };
}
