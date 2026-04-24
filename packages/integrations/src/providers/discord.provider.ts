import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  DiscordConfig,
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

export class DiscordNotificationProvider implements INotificationProvider {
  readonly name = "discord";

  constructor(private readonly config: DiscordConfig) {}

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: notification.title,
          embeds: [
            {
              title: notification.title,
              description: notification.message,
              color: levelToColor(notification.level),
              timestamp: notification.timestamp?.toISOString() ?? new Date().toISOString(),
              footer: { text: `Level: ${notification.level}` },
            },
          ],
          ...(this.config.username && { username: this.config.username }),
          ...(this.config.avatarUrl && { avatar_url: this.config.avatarUrl }),
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { success: false, error: `Discord returned ${response.status}: ${body}` };
      }

      return { success: true, messageId: `discord-${Date.now()}` };
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
        body: JSON.stringify({ content: "Forge notification test" }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        return { success: false, error: `Discord returned ${response.status}` };
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
