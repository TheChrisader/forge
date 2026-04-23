import { SERVICE_KEY_STRINGS, type ServiceContainer, type ServiceModule } from "@forge/core";
import { PrismaClient } from "@forge/database";
import { AlertService } from "../services/alert.service.js";
import { AlertRuleService } from "../services/alert-rule.service.js";
import { AlertChannelService } from "../services/alert-channel.service.js";

export class AlertModule implements ServiceModule {
  register(container: ServiceContainer): void {
    container.singleton(SERVICE_KEY_STRINGS.ALERT_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new AlertService(db);
    });

    container.singleton(SERVICE_KEY_STRINGS.ALERT_RULE_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new AlertRuleService(db);
    });

    container.singleton(SERVICE_KEY_STRINGS.ALERT_CHANNEL_SERVICE, () => {
      const db = container.resolveSync<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
      return new AlertChannelService(db);
    });
  }
}
