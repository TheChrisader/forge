import type { PrismaClient, AlertChannel } from "@forge/database";
import { BadRequestError, ConflictError, NotFoundError } from "@forge/core";

export interface ListAlertChannelFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  type?: string[];
}

interface ChannelWithRules extends AlertChannel {
  rules: Array<{
    id: string;
    ruleId: string;
    channelId: string;
    severities: string[];
    rule: { id: string; name: string; metric: string; severity: string };
  }>;
}

const CHANNEL_CONFIG_REQUIREMENTS: Record<string, string[]> = {
  WEBHOOK: ["url"],
  EMAIL: ["emailAddress"],
  SLACK: ["webhookUrl"],
  DISCORD: ["webhookUrl"],
  TEAMS: ["webhookUrl"],
  PAGERDUTY: ["routingKey"],
  SMS: ["phoneNumber"],
};

function validateChannelConfig(type: string, config: Record<string, unknown>): void {
  const required = CHANNEL_CONFIG_REQUIREMENTS[type];
  if (!required) return;

  const missing = required.filter((field) => {
    const value = config[field];
    return value === undefined || value === null || (typeof value === "string" && !value.trim());
  });

  if (missing.length > 0) {
    throw new BadRequestError(
      `Channel type "${type}" requires config fields: ${missing.join(", ")}`
    );
  }

  if (type === "WEBHOOK" || type === "SLACK" || type === "DISCORD" || type === "TEAMS") {
    const urlField = type === "WEBHOOK" ? "url" : "webhookUrl";
    const url = config[urlField];
    if (typeof url === "string") {
      try {
        new URL(url);
      } catch {
        throw new BadRequestError(`"${urlField}" must be a valid URL`);
      }
    }
  }

  if (type === "EMAIL") {
    const email = config.emailAddress;
    if (typeof email === "string" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestError('"emailAddress" must be a valid email address');
    }
  }
}

export class AlertChannelService {
  constructor(private readonly db: PrismaClient) {}

  async list(
    filters: ListAlertChannelFilters
  ): Promise<{ channels: AlertChannel[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.type && filters.type.length > 0) {
      where.type = { in: filters.type };
    }

    const [channels, total] = await Promise.all([
      this.db.alertChannel.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db.alertChannel.count({ where }),
    ]);

    return { channels, total };
  }

  async getById(id: string): Promise<ChannelWithRules> {
    const channel = await this.db.alertChannel.findUnique({
      where: { id },
      include: {
        rules: {
          include: {
            rule: { select: { id: true, name: true, metric: true, severity: true } },
          },
        },
      },
    });

    if (!channel) {
      throw new NotFoundError(`Alert channel "${id}" not found`);
    }

    return channel as ChannelWithRules;
  }

  async create(data: {
    projectId?: string | null;
    name: string;
    type: string;
    config: Record<string, unknown>;
    enabled?: boolean;
  }): Promise<AlertChannel> {
    validateChannelConfig(data.type, data.config);

    return this.db.alertChannel.create({
      data: {
        projectId: data.projectId ?? null,
        name: data.name,
        type: data.type as never,
        config: data.config as never,
        enabled: data.enabled ?? true,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      type?: string;
      config?: Record<string, unknown>;
      enabled?: boolean;
    }
  ): Promise<AlertChannel> {
    const existing = await this.db.alertChannel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Alert channel "${id}" not found`);
    }

    const effectiveType = data.type ?? (existing.type as string);
    const effectiveConfig = data.config ?? (existing.config as Record<string, unknown>);

    if (data.config || data.type) {
      validateChannelConfig(effectiveType, effectiveConfig);
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.type !== undefined) updateData.type = data.type;
    if (data.config !== undefined) updateData.config = data.config;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    return this.db.alertChannel.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.alertChannel.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Alert channel "${id}" not found`);
    }

    await this.db.alertChannel.delete({ where: { id } });
  }

  async addRule(channelId: string, ruleId: string, severities: string[]): Promise<{ id: string }> {
    const [channel, rule] = await Promise.all([
      this.db.alertChannel.findUnique({ where: { id: channelId } }),
      this.db.alertRule.findUnique({ where: { id: ruleId } }),
    ]);

    if (!channel) {
      throw new NotFoundError(`Alert channel "${channelId}" not found`);
    }
    if (!rule) {
      throw new NotFoundError(`Alert rule "${ruleId}" not found`);
    }

    const existing = await this.db.alertChannelRule.findUnique({
      where: { ruleId_channelId: { ruleId, channelId } },
    });

    if (existing) {
      throw new ConflictError("This rule is already linked to this channel");
    }

    const link = await this.db.alertChannelRule.create({
      data: {
        ruleId,
        channelId,
        severities: severities as never,
      },
    });

    return { id: link.id };
  }

  async removeRule(channelId: string, ruleId: string): Promise<void> {
    const existing = await this.db.alertChannelRule.findUnique({
      where: { ruleId_channelId: { ruleId, channelId } },
    });

    if (!existing) {
      throw new NotFoundError("This rule is not linked to this channel");
    }

    await this.db.alertChannelRule.delete({
      where: { ruleId_channelId: { ruleId, channelId } },
    });
  }
}
