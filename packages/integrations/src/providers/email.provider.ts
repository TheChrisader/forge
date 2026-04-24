import nodemailer from "nodemailer";
import type {
  INotificationProvider,
  Notification,
  NotificationResult,
  EmailConfig,
} from "../interfaces/notification";

export class EmailNotificationProvider implements INotificationProvider {
  readonly name = "email";
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly config: EmailConfig) {}

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: this.config.host,
        port: this.config.port,
        secure: this.config.secure,
        auth: this.config.auth,
      });
    }
    return this.transporter;
  }

  async send(notification: Notification): Promise<NotificationResult> {
    try {
      const transporter = this.getTransporter();

      const results = await Promise.allSettled(
        this.config.to.map((recipient) =>
          transporter.sendMail({
            from: this.config.from,
            to: recipient,
            subject: `[Forge ${notification.level}] ${notification.title}`,
            text: notification.message,
            html: `
              <h2>${notification.title}</h2>
              <p>${notification.message}</p>
              <hr />
              <p><small>Level: ${notification.level}</small></p>
            `,
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected");
      if (failed.length === results.length) {
        const reason: unknown = failed[0].reason;
        return {
          success: false,
          error: reason instanceof Error ? reason.message : String(reason),
        };
      }

      return {
        success: true,
        messageId: `email-${Date.now()}`,
        error:
          failed.length > 0 ? `${failed.length} of ${results.length} recipients failed` : undefined,
      };
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
      await this.getTransporter().verify();
      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  validate(config: unknown): { valid: boolean; errors?: string[] } {
    const cfg = config as Record<string, unknown>;
    const errors: string[] = [];

    if (!cfg.host || typeof cfg.host !== "string") errors.push("host is required");
    if (!cfg.port || typeof cfg.port !== "number") errors.push("port is required");
    if (typeof cfg.secure !== "boolean") errors.push("secure must be boolean");
    if (!cfg.auth || typeof cfg.auth !== "object") {
      errors.push("auth is required");
    } else {
      const auth = cfg.auth as Record<string, unknown>;
      if (!auth.user || typeof auth.user !== "string") errors.push("auth.user is required");
      if (!auth.pass || typeof auth.pass !== "string") errors.push("auth.pass is required");
    }
    if (!cfg.from || typeof cfg.from !== "string") errors.push("from is required");
    if (!cfg.to || !Array.isArray(cfg.to) || cfg.to.length === 0)
      errors.push("to must be a non-empty array");

    return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined };
  }
}
