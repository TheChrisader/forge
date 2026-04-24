import type { PrismaClient } from "@forge/database";
import { QueueService, QUEUE_NAMES } from "@forge/queue";
import type { NotificationJobData } from "@forge/types";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";
import { NotificationRateLimiter } from "./rate-limiter";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "INFO",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "notification-dispatcher",
});

export class NotificationDispatcher {
  constructor(
    private readonly db: PrismaClient,
    private readonly queueService: QueueService,
    private readonly rateLimiter: NotificationRateLimiter
  ) {}

  async dispatchForAlert(alertId: string): Promise<void> {
    const alert = await this.db.alert.findUnique({
      where: { id: alertId },
      include: {
        rule: {
          include: {
            channels: {
              include: {
                channel: true,
              },
            },
          },
        },
      },
    });

    if (!alert || !alert.rule) {
      logger.warn("Alert or rule not found for dispatch", { alertId });
      return;
    }

    const channelRules = alert.rule.channels.filter((cr) => {
      if (!cr.channel || !cr.channel.enabled) return false;
      // Check if the alert severity matches the channel rule's severity filter
      if (cr.severities.length > 0 && !cr.severities.includes(alert.severity)) return false;
      return true;
    });

    if (channelRules.length === 0) {
      logger.debug("No matching channels for alert", { alertId });
      return;
    }

    for (const channelRule of channelRules) {
      const channelId = channelRule.channelId;

      // Dedup: skip if a PENDING or SENT notification already exists for this alert+channel
      const existing = await this.db.alertNotification.findFirst({
        where: {
          alertId,
          channelId,
          status: { not: "FAILED" },
        },
      });

      if (existing) {
        logger.debug("Notification already exists for alert+channel", { alertId, channelId });
        continue;
      }

      // Rate limit check
      if (!this.rateLimiter.isAllowed(channelId)) {
        logger.warn("Rate limited, skipping channel", { channelId, alertId });
        continue;
      }

      // Create AlertNotification record (PENDING)
      const notification = await this.db.alertNotification.create({
        data: {
          alertId,
          channelId,
          status: "PENDING",
        },
      });

      // Build job data
      const jobData: NotificationJobData = {
        alertNotificationId: notification.id,
        alertNotificationTimestamp: notification.timestamp.toISOString(),
        channelId,
        channelType: channelRule.channel.type as string,
        channelConfig: channelRule.channel.config as Record<string, unknown>,
        notification: {
          title: `Forge Alert: ${alert.severity}`,
          message: alert.message,
          level: alert.severity,
          metadata: {
            alertId,
            ruleId: alert.ruleId,
            ruleName: alert.rule.name,
            severity: alert.severity,
            firedAt: alert.firedAt.toISOString(),
          },
        },
      };

      // Enqueue to notifications queue with retry
      await this.queueService.addJob(
        QUEUE_NAMES.NOTIFICATIONS,
        `notify-${notification.id}`,
        jobData,
        {
          attempts: 5,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 50,
        }
      );

      logger.info("Notification dispatched", {
        alertId,
        channelId,
        notificationId: notification.id,
        channelType: channelRule.channel.type,
      });
    }
  }
}
