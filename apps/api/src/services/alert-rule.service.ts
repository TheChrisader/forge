import type { PrismaClient, AlertRule } from "@forge/database";
import { BadRequestError, NotFoundError } from "@forge/core";

export interface ListAlertRuleFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  enabled?: boolean;
  severity?: string[];
}

interface RuleWithChannels extends AlertRule {
  channels: Array<{
    id: string;
    ruleId: string;
    channelId: string;
    severities: string[];
    channel: { id: string; name: string; type: string };
  }>;
}

export class AlertRuleService {
  constructor(private readonly db: PrismaClient) {}

  async list(filters: ListAlertRuleFilters): Promise<{ rules: AlertRule[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.projectId) {
      where.projectId = filters.projectId;
    }

    if (filters.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    if (filters.severity && filters.severity.length > 0) {
      where.severity = { in: filters.severity };
    }

    const [rules, total] = await Promise.all([
      this.db.alertRule.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.db.alertRule.count({ where }),
    ]);

    return { rules, total };
  }

  async getById(id: string): Promise<RuleWithChannels> {
    const rule = await this.db.alertRule.findUnique({
      where: { id },
      include: {
        channels: {
          include: {
            channel: { select: { id: true, name: true, type: true } },
          },
        },
      },
    });

    if (!rule) {
      throw new NotFoundError(`Alert rule "${id}" not found`);
    }

    return rule as RuleWithChannels;
  }

  async create(
    data: {
      projectId: string;
      name: string;
      description?: string | null;
      metric: string;
      operator: string;
      threshold: number;
      duration: number;
      severity: string;
      sourceType?: string | null;
      sourceId?: string | null;
      enabled?: boolean;
    },
    userId?: string
  ): Promise<AlertRule> {
    if (!data.metric.trim()) {
      throw new BadRequestError("Metric name must not be empty");
    }

    if (data.threshold < 0) {
      throw new BadRequestError("Threshold must be non-negative");
    }

    return this.db.alertRule.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        description: data.description ?? null,
        metric: data.metric,
        operator: data.operator as never,
        threshold: data.threshold,
        duration: data.duration,
        severity: data.severity as never,
        sourceType: (data.sourceType as never) ?? null,
        sourceId: data.sourceId ?? null,
        enabled: data.enabled ?? true,
        createdBy: userId ?? null,
      },
    });
  }

  async update(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      metric?: string;
      operator?: string;
      threshold?: number;
      duration?: number;
      severity?: string;
      sourceType?: string | null;
      sourceId?: string | null;
      enabled?: boolean;
    }
  ): Promise<AlertRule> {
    const existing = await this.db.alertRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Alert rule "${id}" not found`);
    }

    if (data.metric !== undefined && !data.metric.trim()) {
      throw new BadRequestError("Metric name must not be empty");
    }

    if (data.threshold !== undefined && data.threshold < 0) {
      throw new BadRequestError("Threshold must be non-negative");
    }

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.metric !== undefined) updateData.metric = data.metric;
    if (data.operator !== undefined) updateData.operator = data.operator;
    if (data.threshold !== undefined) updateData.threshold = data.threshold;
    if (data.duration !== undefined) updateData.duration = data.duration;
    if (data.severity !== undefined) updateData.severity = data.severity;
    if (data.sourceType !== undefined) updateData.sourceType = data.sourceType;
    if (data.sourceId !== undefined) updateData.sourceId = data.sourceId;
    if (data.enabled !== undefined) updateData.enabled = data.enabled;

    return this.db.alertRule.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<void> {
    const existing = await this.db.alertRule.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundError(`Alert rule "${id}" not found`);
    }

    await this.db.alertRule.delete({ where: { id } });
  }
}
