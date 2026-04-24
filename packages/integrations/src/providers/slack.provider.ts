import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  SlackConfig,
} from "../interfaces/notification";

const REQUEST_TIMEOUT = 10_000;

function levelToColor(level: string): number {
  switch (level) {
    case "ERROR":
      return 0xe01e5a;
    case "WARNING":
      return 0xffa500;
    case "SUCCESS":
      return 0x2eb67d;
    default:
      return 0x36c5f0;
  }
}

export class SlackNotificationProvider implements INotificationProvider {
  readonly name = "slack";

  constructor(private readonly config: SlackConfig) {}

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: notification.title,
          blocks: [
            {
              type: "section",
              text: { type: "mrkdwn", text: `*${notification.title}*` },
            },
            {
              type: "section",
              text: { type: "mrkdwn", text: notification.message },
            },
            {
              type: "context",
              elements: [{ type: "mrkdwn", text: `Level: \`${notification.level}\`` }],
            },
          ],
          attachments: [
            { color: `#${levelToColor(notification.level).toString(16).padStart(6, "0")}` },
          ],
          ...(this.config.channel && { channel: this.config.channel }),
          ...(this.config.username && { username: this.config.username }),
          ...(this.config.iconEmoji && { icon_emoji: this.config.iconEmoji }),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { success: false, error: `Slack returned ${response.status}: ${body}` };
      }

      return { success: true, messageId: `slack-${Date.now()}` };
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
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: "Forge notification test" }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        return { success: false, error: `Slack returned ${response.status}` };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const cfg = config as Record<string, unknown>;
    const errors: string[] = [];

    if (!cfg.webhookUrl || typeof cfg.webhookUrl !== "string") {
      errors.push("webhookUrl is required");
    } else {
      try {
        new URL(cfg.webhookUrl);
      } catch {
        errors.push("webhookUrl must be a valid URL");
      }
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
