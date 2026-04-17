import type { PrismaClient } from "@forge/database";
import type { AuditLog, AuditLogQueryParams } from "@forge/types";
import { ValidationError } from "@forge/core";

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const MAX_DATE_RANGE_DAYS = 90;

interface AuditLogResult {
  items: AuditLog[];
  total: number;
  page: number;
  limit: number;
}

export class AuditLogService {
  constructor(private readonly db: PrismaClient) {}

  async query(params: AuditLogQueryParams): Promise<AuditLogResult> {
    const page = Math.max(DEFAULT_PAGE, params.page ?? DEFAULT_PAGE);
    const limit = Math.min(MAX_LIMIT, Math.max(1, params.limit ?? DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(params);

    const [items, total] = await Promise.all([
      this.db.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { timestamp: "desc" },
      }),
      this.db.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  private buildWhereClause(params: AuditLogQueryParams): Record<string, unknown> {
    const conditions: Record<string, unknown>[] = [];

    if (params.action) {
      conditions.push({ action: { endsWith: params.action } });
    }

    if (params.resourceType) {
      conditions.push({ resourceType: params.resourceType });
    }

    if (params.userId) {
      conditions.push({ userId: params.userId });
    }

    if (params.projectId) {
      conditions.push({ projectId: params.projectId });
    }

    if (params.since || params.until) {
      const range: Record<string, Date> = {};
      const since = params.since ? new Date(params.since) : null;
      const until = params.until ? new Date(params.until) : null;

      if (since && until && since > until) {
        throw new ValidationError("'since' date must be before 'until' date");
      }

      if (since && until) {
        const rangeMs = until.getTime() - since.getTime();
        const maxRangeMs = MAX_DATE_RANGE_DAYS * 24 * 60 * 60 * 1000;
        if (rangeMs > maxRangeMs) {
          throw new ValidationError(`Date range cannot exceed ${MAX_DATE_RANGE_DAYS} days`);
        }
      }

      if (since) range.gte = since;
      if (until) range.lte = until;
      conditions.push({ timestamp: range });
    }

    if (params.search) {
      const term = params.search;
      conditions.push({
        OR: [
          { userEmail: { contains: term, mode: "insensitive" } },
          { action: { contains: term, mode: "insensitive" } },
        ],
      });
    }

    return conditions.length > 0 ? { AND: conditions } : {};
  }
}
