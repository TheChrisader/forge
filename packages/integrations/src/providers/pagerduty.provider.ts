import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  PagerDutyConfig,
} from "../interfaces/notification";

const REQUEST_TIMEOUT = 10_000;
const PAGERDUTY_EVENTS_URL = "https://events.pagerduty.com/v2/enqueue";

function mapSeverity(level: string): "critical" | "high" | "low" | "info" {
  switch (level) {
    case "ERROR":
      return "critical";
    case "WARNING":
      return "high";
    case "SUCCESS":
      return "info";
    default:
      return "low";
  }
}

export class PagerDutyNotificationProvider implements INotificationProvider {
  readonly name = "pagerduty";

  constructor(private readonly config: PagerDutyConfig) {}

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      const payload = {
        routing_key: this.config.routingKey,
        event_action: "trigger",
        payload: {
          summary: `${notification.title}: ${notification.message}`,
          severity: this.config.severity ?? mapSeverity(notification.level),
          source: "forge-platform",
          component: this.config.component ?? "alerts",
          group: this.config.group,
          timestamp: notification.timestamp?.toISOString() ?? new Date().toISOString(),
          custom_details: {
            level: notification.level,
            ...(notification.metadata as Record<string, unknown>),
          },
        },
      };

      const response = await fetch(PAGERDUTY_EVENTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { success: false, error: `PagerDuty returned ${response.status}: ${body}` };
      }

      const data = (await response.json()) as { dedup_key?: string };
      return { success: true, messageId: data.dedup_key ?? `pd-${Date.now()}` };
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
    if (!this.config.routingKey || this.config.routingKey.trim().length === 0) {
      return { success: false, error: "routingKey is required" };
    }

    try {
      const response = await fetch(PAGERDUTY_EVENTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routing_key: this.config.routingKey,
          event_action: "trigger",
          payload: {
            summary: "Forge notification test",
            severity: "info",
            source: "forge-platform",
            component: this.config.component ?? "alerts",
          },
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        return { success: false, error: `PagerDuty returned ${response.status}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const cfg = config as Record<string, unknown>;
    const errors: string[] = [];

    if (!cfg.routingKey || typeof cfg.routingKey !== "string") {
      errors.push("routingKey is required");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
