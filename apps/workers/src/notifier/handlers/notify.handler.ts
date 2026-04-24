import type { IJobContext } from "@forge/queue";
import type { NotificationJobData } from "@forge/types";
import { getDatabaseClient } from "@forge/database";
import { createNotificationProvider } from "@forge/integrations";
import type { INotificationProvider, Notification } from "@forge/integrations";
import { LoggerService } from "@forge/logger";
import type { LogLevel } from "@forge/types";

const logger = new LoggerService({
  level: (process.env.LOG_LEVEL as LogLevel) ?? "info",
  format: process.env.NODE_ENV === "development" ? "pretty" : "json",
  enabled: true,
  name: "notify-handler",
});

interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

async function resolvePushSubscriptions(
  db: ReturnType<typeof getDatabaseClient>,
  channelId: string
): Promise<PushSubscriptionRow[]> {
  // Find the channel and its project, then the team members' subscriptions
  const channel = await db.alertChannel.findUnique({
    where: { id: channelId },
    select: { projectId: true },
  });

  if (!channel?.projectId) {
    // Global channel — fetch all subscriptions
    const subs = await db.pushSubscription.findMany({
      select: { endpoint: true, p256dh: true, auth: true },
    });
    return subs;
  }

  // Project-scoped channel — find team members for this project
  const project = await db.project.findUnique({
    where: { id: channel.projectId },
    select: { teamId: true },
  });

  if (!project?.teamId) {
    // Project has no team — fetch all subscriptions
    const subs = await db.pushSubscription.findMany({
      select: { endpoint: true, p256dh: true, auth: true },
    });
    return subs;
  }

  // Get team member user IDs, then their push subscriptions
  const teamMembers = await db.teamMember.findMany({
    where: { teamId: project.teamId },
    select: { userId: true },
  });

  const userIds = teamMembers.map((m) => m.userId);

  if (userIds.length === 0) {
    return [];
  }

  return db.pushSubscription.findMany({
    where: { userId: { in: userIds } },
    select: { endpoint: true, p256dh: true, auth: true },
  });
}

async function cleanupStaleSubscriptions(
  db: ReturnType<typeof getDatabaseClient>,
  staleEndpoints: string[]
): Promise<void> {
  if (staleEndpoints.length === 0) return;

  try {
    const result = await db.pushSubscription.deleteMany({
      where: { endpoint: { in: staleEndpoints } },
    });
    if (result.count > 0) {
      logger.info("Cleaned up stale push subscriptions", { count: result.count });
    }
  } catch (err) {
    logger.error("Failed to clean up stale push subscriptions", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

function extractStaleEndpoints(error: string | undefined): string[] {
  if (!error) return [];
  const match = error.match(/^Stale subscriptions: (.+)$/);
  if (!match) return [];
  return match[1].split(", ").filter(Boolean);
}

export async function handleNotifyJob(context: IJobContext<NotificationJobData>): Promise<void> {
  const data = context.job.data;
  const db = getDatabaseClient();

  let provider: INotificationProvider;
  try {
    provider = createNotificationProvider(data.channelType, data.channelConfig);
  } catch (err) {
    // Permanent error — invalid provider type or config
    await markFailed(db, data, err instanceof Error ? err.message : String(err));
    return;
  }

  const metadata: Record<string, unknown> = { ...data.notification.metadata };

  // PUSH channels need subscriptions resolved at send time
  if (data.channelType === "PUSH") {
    const subscriptions = await resolvePushSubscriptions(db, data.channelId);
    if (subscriptions.length === 0) {
      await markFailed(db, data, "No push subscriptions found for target users");
      return;
    }
    metadata.subscriptions = subscriptions;
  }

  const notification: Notification = {
    title: data.notification.title,
    message: data.notification.message,
    level: data.notification.level as Notification["level"],
    timestamp: new Date(),
    metadata,
  };

  try {
    const result = await provider.send(notification);

    if (result.success) {
      await db.alertNotification.update({
        where: {
          id_timestamp: {
            id: data.alertNotificationId,
            timestamp: new Date(data.alertNotificationTimestamp),
          },
        },
        data: {
          status: "SENT",
          sentAt: new Date(),
          error: null,
        },
      });

      logger.info("Notification sent", {
        notificationId: data.alertNotificationId,
        channelType: data.channelType,
        messageId: result.messageId,
      });
    } else {
      await markFailed(db, data, result.error ?? "Provider returned unsuccessful result");
      logger.warn("Notification delivery failed", {
        notificationId: data.alertNotificationId,
        channelType: data.channelType,
        error: result.error,
      });
    }

    // Clean up stale push subscriptions (410 Gone / 404)
    if (data.channelType === "PUSH") {
      const staleEndpoints = extractStaleEndpoints(result.error);
      await cleanupStaleSubscriptions(db, staleEndpoints);
    }
  } catch (err) {
    // Transient error — let BullMQ retry
    logger.error("Notification provider threw, will retry", {
      notificationId: data.alertNotificationId,
      channelType: data.channelType,
      error: err instanceof Error ? err.message : String(err),
      attemptsMade: context.job.attemptsMade,
    });
    throw err;
  }
}

async function markFailed(
  db: ReturnType<typeof getDatabaseClient>,
  data: NotificationJobData,
  error: string
): Promise<void> {
  try {
    await db.alertNotification.update({
      where: {
        id_timestamp: {
          id: data.alertNotificationId,
          timestamp: new Date(data.alertNotificationTimestamp),
        },
      },
      data: {
        status: "FAILED",
        error,
      },
    });
  } catch (updateErr) {
    logger.error("Failed to update notification status", {
      notificationId: data.alertNotificationId,
      error: updateErr instanceof Error ? updateErr.message : String(updateErr),
    });
  }
}
