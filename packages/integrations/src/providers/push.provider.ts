import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  PushConfig,
} from "../interfaces/notification";
import webpush from "web-push";

interface PushSubscription {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

interface PushNotificationMetadata {
  subscriptions?: PushSubscription[];
}

export class PushNotificationProvider implements INotificationProvider {
  readonly name = "push";

  private readonly vapidPublicKey: string;
  private readonly vapidPrivateKey: string;
  private readonly vapidSubject: string;

  constructor(config: Record<string, unknown>) {
    const cfg = config as unknown as PushConfig;
    if (!cfg.vapidPublicKey || !cfg.vapidPrivateKey || !cfg.vapidSubject) {
      throw new Error(
        "Push provider requires vapidPublicKey, vapidPrivateKey, and vapidSubject in config"
      );
    }
    this.vapidPublicKey = cfg.vapidPublicKey;
    this.vapidPrivateKey = cfg.vapidPrivateKey;
    this.vapidSubject = cfg.vapidSubject;

    webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey);
  }

  async send(notification: Notification): Promise<NotificationResult> {
    const metadata = notification.metadata as PushNotificationMetadata | undefined;
    const subscriptions = metadata?.subscriptions;

    if (!subscriptions || subscriptions.length === 0) {
      return { success: false, error: "No push subscriptions provided in notification metadata" };
    }

    const payload = JSON.stringify({
      title: notification.title,
      body: notification.message,
      level: notification.level,
      timestamp: notification.timestamp?.toISOString() ?? new Date().toISOString(),
      data: notification.metadata ?? {},
    });

    let successCount = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: sub.keys,
          },
          payload,
          {
            TTL: 86400,
            vapidDetails: {
              subject: this.vapidSubject,
              publicKey: this.vapidPublicKey,
              privateKey: this.vapidPrivateKey,
            },
          }
        );
        successCount++;
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;

        // 410 Gone means the subscription is no longer valid
        if (statusCode === 410 || statusCode === 404) {
          failedEndpoints.push(sub.endpoint);
        }
        // Other errors (transient) are logged but don't fail the entire batch
      }
    }

    return {
      success: successCount > 0,
      messageId: `push:${successCount}/${subscriptions.length}`,
      error:
        failedEndpoints.length > 0
          ? `Stale subscriptions: ${failedEndpoints.join(", ")}`
          : successCount === 0
            ? "All push deliveries failed"
            : undefined,
    };
  }

  async sendBatch(notifications: Notification[]): Promise<NotificationResult[]> {
    return Promise.all(notifications.map((n) => this.send(n)));
  }

  async test(): Promise<{ success: boolean; error?: string }> {
    if (!this.vapidPublicKey || !this.vapidPrivateKey) {
      return await Promise.resolve({ success: false, error: "VAPID keys not configured" });
    }

    try {
      await Promise.resolve(
        webpush.setVapidDetails(this.vapidSubject, this.vapidPublicKey, this.vapidPrivateKey)
      );
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: `VAPID configuration invalid: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const errors: string[] = [];
    const cfg = config as Record<string, unknown>;

    if (!cfg.vapidPublicKey) errors.push("vapidPublicKey is required");
    if (!cfg.vapidPrivateKey) errors.push("vapidPrivateKey is required");
    if (!cfg.vapidSubject) errors.push("vapidSubject is required");

    return errors.length > 0 ? { valid: false, errors } : { valid: true };
  }
}
