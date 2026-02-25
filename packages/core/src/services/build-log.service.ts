/**
 * BuildLogService - Manages durable storage and querying of build logs
 *
 * Provides methods for appending logs (single or batch), querying with filters,
 * and managing log lifecycle. Uses TimescaleDB hypertable for efficient time-series
 * storage of millions of log lines.
 */

import type { PrismaClient } from "@forge/database";
import type { BuildLog, LogLevel, BuildLogSource } from "@forge/types";

export interface BuildLogEntry {
  deploymentId: string;
  lineNumber: number;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source: BuildLogSource;
}

export interface BuildLogQuery {
  deploymentId: string;
  fromLine?: number;
  toLine?: number;
  fromTime?: Date;
  toTime?: Date;
  level?: LogLevel;
  source?: BuildLogSource;
  search?: string;
  limit?: number;
}

/**
 * BuildLogService handles all build log operations
 */
export class BuildLogService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Appends a single log line. Use appendBatch() for bulk inserts.
   * @param entry - The log entry to append
   * @throws {Error} If database write fails
   */
  async append(entry: BuildLogEntry): Promise<void> {
    try {
      await this.db.buildLog.create({
        data: entry,
      });
    } catch (error) {
      throw new Error(
        `Failed to append build log for deployment ${entry.deploymentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Appends multiple log lines in a single transaction (faster).
   * @param entries - Array of log entries to append
   * @throws {Error} If database write fails
   */
  async appendBatch(entries: BuildLogEntry[]): Promise<void> {
    if (entries.length === 0) return;

    try {
      await this.db.buildLog.createMany({
        data: entries,
        skipDuplicates: true,
      });
    } catch (error) {
      const deploymentId = entries[0]?.deploymentId ?? "unknown";
      throw new Error(
        `Failed to append batch of ${entries.length} build logs for deployment ${deploymentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Queries logs with filters.
   * @param query - Query parameters for filtering logs
   * @returns Array of build log entries matching the query
   * @throws {Error} If database query fails
   */
  async query(query: BuildLogQuery): Promise<BuildLog[]> {
    try {
      const where: Record<string, unknown> = {
        deploymentId: query.deploymentId,
      };

      if (query.fromLine !== undefined || query.toLine !== undefined) {
        where.lineNumber = {};
        if (query.fromLine !== undefined) {
          (where.lineNumber as Record<string, unknown>).gte = query.fromLine;
        }
        if (query.toLine !== undefined) {
          (where.lineNumber as Record<string, unknown>).lte = query.toLine;
        }
      }

      if (query.fromTime || query.toTime) {
        where.timestamp = {};
        if (query.fromTime) {
          (where.timestamp as Record<string, unknown>).gte = query.fromTime;
        }
        if (query.toTime) {
          (where.timestamp as Record<string, unknown>).lte = query.toTime;
        }
      }

      if (query.level) {
        where.level = query.level;
      }

      if (query.source) {
        where.source = query.source;
      }

      if (query.search) {
        where.message = { contains: query.search, mode: "insensitive" };
      }

      const logs = await this.db.buildLog.findMany({
        where,
        orderBy: { lineNumber: "asc" },
        take: query.limit ?? 1000,
      });

      return logs;
    } catch (error) {
      throw new Error(
        `Failed to query build logs for deployment ${query.deploymentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the total line count for a deployment.
   * @param deploymentId - The deployment ID to count logs for
   * @returns Number of log lines for the deployment
   * @throws {Error} If database query fails
   */
  async getLineCount(deploymentId: string): Promise<number> {
    try {
      return await this.db.buildLog.count({
        where: { deploymentId },
      });
    } catch (error) {
      throw new Error(
        `Failed to get line count for deployment ${deploymentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Gets the most recent N lines (useful for tailing logs).
   * @param deploymentId - The deployment ID to tail logs for
   * @param lines - Number of recent lines to retrieve (default: 100)
   * @returns Array of recent log lines in chronological order
   * @throws {Error} If database query fails
   */
  async tail(deploymentId: string, lines = 100): Promise<BuildLog[]> {
    try {
      const logs = await this.db.buildLog.findMany({
        where: { deploymentId },
        orderBy: { lineNumber: "desc" },
        take: lines,
      });

      return logs.reverse(); // return in chronological order
    } catch (error) {
      throw new Error(
        `Failed to tail logs for deployment ${deploymentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Deletes all logs for a deployment (cascaded by deployment deletion).
   * @param deploymentId - The deployment ID to delete logs for
   * @throws {Error} If database deletion fails
   */
  async deleteForDeployment(deploymentId: string): Promise<void> {
    try {
      await this.db.buildLog.deleteMany({
        where: { deploymentId },
      });
    } catch (error) {
      throw new Error(
        `Failed to delete logs for deployment ${deploymentId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}
