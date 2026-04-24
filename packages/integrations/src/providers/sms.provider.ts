import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  SmsConfig,
} from "../interfaces/notification";

/* eslint-disable @typescript-eslint/require-await */

export class SmsNotificationProvider implements INotificationProvider {
  readonly name = "sms";

  constructor(private readonly config: SmsConfig) {}

  async send(_notification: Notification): Promise<NotificationResult> {
    return {
      success: false,
      error: `SMS delivery requires an external provider (e.g., Twilio, SNS). Configured provider: ${this.config.provider ?? "none"}`,
    };
  }

  async sendBatch(notifications: Notification[]): Promise<NotificationResult[]> {
    return notifications.map(() => ({
      success: false,
      error: "SMS delivery requires an external provider (e.g., Twilio, SNS)",
    }));
  }

  async test(): Promise<{ success: boolean; error?: string }> {
    return {
      success: false,
      error:
        "SMS delivery requires an external provider (e.g., Twilio, SNS). Configure a provider to enable SMS notifications.",
    };
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const cfg = config as Record<string, unknown>;
    const errors: string[] = [];

    if (!cfg.phoneNumber || typeof cfg.phoneNumber !== "string") {
      errors.push("phoneNumber is required");
    } else if (!/^\+?[\d\s-()]{7,20}$/.test(cfg.phoneNumber)) {
      errors.push("phoneNumber must be a valid phone number");
    }

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
