/**
 * Notification provider interface
 * Allows pluggable notification backends (Slack, Discord, Email, Webhooks, etc.)
 */

export type NotificationLevel = "INFO" | "SUCCESS" | "WARNING" | "ERROR";

export interface Notification {
  title: string;
  message: string;
  level: NotificationLevel;
  metadata?: Record<string, unknown>;
  timestamp?: Date;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface INotificationProvider {
  /**
   * Provider name
   */
  readonly name: string;

  send(notification: Notification): Promise<NotificationResult>;

  sendBatch(notifications: Notification[]): Promise<NotificationResult[]>;

  test(): Promise<{ success: boolean; error?: string }>;

  validate(config: unknown): { valid: boolean; errors?: string[] };
}

export interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export interface DiscordConfig {
  webhookUrl: string;
  username?: string;
  avatarUrl?: string;
}

export interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
}

export interface WebhookConfig {
  url: string;
  method: "GET" | "POST";
  headers?: Record<string, string>;
}

export interface TeamsConfig {
  webhookUrl: string;
}

export interface PagerDutyConfig {
  routingKey: string;
  severity?: "critical" | "high" | "low" | "info";
  component?: string;
  group?: string;
}

export interface SmsConfig {
  phoneNumber: string;
  provider?: "twilio" | "sns";
}

export interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  vapidSubject: string;
}

export type NotificationProviderConfig =
  | { type: "slack"; config: SlackConfig }
  | { type: "discord"; config: DiscordConfig }
  | { type: "email"; config: EmailConfig }
  | { type: "webhook"; config: WebhookConfig }
  | { type: "teams"; config: TeamsConfig }
  | { type: "pagerduty"; config: PagerDutyConfig }
  | { type: "sms"; config: SmsConfig }
  | { type: "push"; config: PushConfig };
