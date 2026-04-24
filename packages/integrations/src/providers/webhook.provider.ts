import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  WebhookConfig,
} from "../interfaces/notification";

const REQUEST_TIMEOUT = 10_000;

export class WebhookNotificationProvider implements INotificationProvider {
  readonly name = "webhook";

  constructor(private readonly config: WebhookConfig) {}

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...this.config.headers,
      };

      const response = await fetch(this.config.url, {
        method: this.config.method ?? "POST",
        headers,
        body: JSON.stringify({
          title: notification.title,
          message: notification.message,
          level: notification.level,
          timestamp: notification.timestamp?.toISOString() ?? new Date().toISOString(),
          metadata: notification.metadata,
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { success: false, error: `Webhook returned ${response.status}: ${body}` };
      }

      return { success: true, messageId: `webhook-${Date.now()}` };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async sendBatch(notifications: Notification[]): Promise<NotificationResult[]> {
    return Promise.all(notifications.map((n) => this.send(n)));
  }

  async test(): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(this.config.url, {
        method: this.config.method ?? "POST",
        headers: {
          "Content-Type": "application/json",
          ...this.config.headers,
        },
        body: JSON.stringify({ test: true, message: "Forge notification test" }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        return { success: false, error: `Webhook returned ${response.status}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const cfg = config as Record<string, unknown>;
    const errors: string[] = [];

    if (!cfg.url || typeof cfg.url !== "string") {
      errors.push("url is required");
    } else {
      try {
        new URL(cfg.url);
      } catch {
        errors.push("url must be a valid URL");
      }
    }

    if (cfg.method && cfg.method !== "GET" && cfg.method !== "POST") {
      errors.push("method must be GET or POST");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
