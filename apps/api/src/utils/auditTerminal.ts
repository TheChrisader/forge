import type { PrismaClient } from "@forge/database";
import type { ILogger } from "@forge/core";
import z from "zod";

const TerminalAuditSchema = z.object({
  userId: z.string(),
  containerId: z.string(),
  action: z.enum(["terminal.open", "terminal.close"]),
  ipAddress: z.string().optional(),
  userAgent: z.string().optional(),
  metadata: z.record(z.string(), z.any()),
});

export type TerminalAuditEntry = z.infer<typeof TerminalAuditSchema>;

export function writeTerminalAudit(
  db: PrismaClient,
  logger: ILogger,
  entry: TerminalAuditEntry
): void {
  const result = TerminalAuditSchema.safeParse(entry);
  if (!result.success) {
    logger.error("Invalid terminal audit entry", { entry, errors: result.error });
    return;
  }

  void db.auditLog
    .create({
      data: {
        userId: entry.userId,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        action: entry.action,
        resourceType: "terminal",
        resourceId: entry.containerId,
        metadata: entry.metadata,
        timestamp: new Date(),
      },
    })
    .catch((err: unknown) => {
      logger.error("Failed to write terminal audit log", { err, ...entry });
    });
}
