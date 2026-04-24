import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  TeamsConfig,
} from "../interfaces/notification";

const REQUEST_TIMEOUT = 10_000;

export class TeamsNotificationProvider implements INotificationProvider {
  readonly name = "teams";

  constructor(private readonly config: TeamsConfig) {}

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      const response = await fetch(this.config.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              contentUrl: null,
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.4",
                body: [
                  {
                    type: "Container",
                    style: "emphasis",
                    items: [
                      {
                        type: "TextBlock",
                        text: notification.title,
                        weight: "Bolder",
                        size: "Medium",
                        color: "Accent",
                      },
                    ],
                  },
                  {
                    type: "TextBlock",
                    text: notification.message,
                    wrap: true,
                  },
                  {
                    type: "FactSet",
                    facts: [
                      { title: "Level", value: notification.level },
                      {
                        title: "Time",
                        value: notification.timestamp?.toISOString() ?? new Date().toISOString(),
                      },
                    ],
                  },
                ],
                padding: "Default",
              },
            },
          ],
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        return { success: false, error: `Teams returned ${response.status}: ${body}` };
      }

      return { success: true, messageId: `teams-${Date.now()}` };
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
        body: JSON.stringify({
          text: "Forge notification test",
        }),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        return { success: false, error: `Teams returned ${response.status}` };
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
