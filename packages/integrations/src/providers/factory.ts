import type { INotificationProvider } from "../interfaces/notification";
import { SlackNotificationProvider } from "./slack.provider";
import { DiscordNotificationProvider } from "./discord.provider";
import { EmailNotificationProvider } from "./email.provider";
import { WebhookNotificationProvider } from "./webhook.provider";
import { TeamsNotificationProvider } from "./teams.provider";
import { PagerDutyNotificationProvider } from "./pagerduty.provider";
import { SmsNotificationProvider } from "./sms.provider";
import { PushNotificationProvider } from "./push.provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ProviderConstructor = new (config: any) => INotificationProvider;

const PROVIDER_MAP: Record<string, ProviderConstructor> = {
  SLACK: SlackNotificationProvider,
  DISCORD: DiscordNotificationProvider,
  EMAIL: EmailNotificationProvider,
  WEBHOOK: WebhookNotificationProvider,
  TEAMS: TeamsNotificationProvider,
  PAGERDUTY: PagerDutyNotificationProvider,
  SMS: SmsNotificationProvider,
  PUSH: PushNotificationProvider,
};

export function createNotificationProvider(
  channelType: string,
  config: Record<string, unknown>
): INotificationProvider {
  const ProviderClass = PROVIDER_MAP[channelType];

  if (!ProviderClass) {
    throw new Error(`Unknown notification channel type: "${channelType}"`);
  }

  return new ProviderClass(config);
}
