import type { PrismaClient, Alert, AlertStatus } from "@forge/database";
import { ConflictError, NotFoundError } from "@forge/core";

export interface ListAlertsFilters {
  page?: number;
  limit?: number;
  projectId?: string;
  status?: string[];
  severity?: string[];
}

interface AlertWithRule extends Alert {
  rule: { id: string; name: string; projectId: string; metric: string } | null;
}

export class AlertService {
  constructor(private readonly db: PrismaClient) {}

  async list(filters: ListAlertsFilters): Promise<{ alerts: AlertWithRule[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filters.projectId) {
      where.rule = { projectId: filters.projectId };
    }

    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.severity && filters.severity.length > 0) {
      where.severity = { in: filters.severity };
    }

    const [alerts, total] = await Promise.all([
      this.db.alert.findMany({
        where,
        skip,
        take: limit,
        include: { rule: { select: { id: true, name: true, projectId: true, metric: true } } },
        orderBy: { firedAt: "desc" },
      }),
      this.db.alert.count({ where }),
    ]);

    return { alerts: alerts as AlertWithRule[], total };
  }

  async getById(id: string): Promise<AlertWithRule> {
    const alert = await this.db.alert.findUnique({
      where: { id },
      include: { rule: { select: { id: true, name: true, projectId: true, metric: true } } },
    });

    if (!alert) {
      throw new NotFoundError(`Alert "${id}" not found`);
    }

    return alert as AlertWithRule;
  }

  async acknowledge(id: string, userId: string): Promise<Alert> {
    const alert = await this.db.alert.findUnique({ where: { id } });

    if (!alert) {
      throw new NotFoundError(`Alert "${id}" not found`);
    }

    if (alert.status === "ACKNOWLEDGED") {
      throw new ConflictError("Alert is already acknowledged");
    }

    if (alert.status === "RESOLVED") {
      throw new ConflictError("Cannot acknowledge a resolved alert");
    }

    return this.db.alert.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED" as AlertStatus,
        acknowledgedAt: new Date(),
        acknowledgedBy: userId,
      },
    });
  }

  async resolve(id: string): Promise<Alert> {
    const alert = await this.db.alert.findUnique({ where: { id } });

    if (!alert) {
      throw new NotFoundError(`Alert "${id}" not found`);
    }

    if (alert.status === "RESOLVED") {
      throw new ConflictError("Alert is already resolved");
    }

    return this.db.alert.update({
      where: { id },
      data: {
        status: "RESOLVED" as AlertStatus,
        resolvedAt: new Date(),
      },
    });
  }
}
