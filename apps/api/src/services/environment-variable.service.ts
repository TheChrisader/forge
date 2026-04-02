import type { PrismaClient } from "@forge/database";
import { NotFoundError, ValidationError } from "@forge/core";

export interface EnvironmentVariable {
  id: string;
  projectId: string;
  environmentId: string | null;
  key: string;
  value: string;
  createdAt: Date;
  updatedAt: Date;
}

export class EnvironmentVariableService {
  constructor(private readonly db: PrismaClient) {}

  /**
   * Lists all environment variables for a project, optionally filtered by environment.
   */
  async list(projectId: string, environmentId?: string): Promise<EnvironmentVariable[]> {
    const where: {
      projectId: string;
      environmentId?: string | null;
    } = { projectId };

    if (environmentId !== undefined) {
      where.environmentId = environmentId;
    }

    return this.db.environmentVariable.findMany({
      where,
      orderBy: { key: "asc" },
    });
  }

  /**
   * Batch upserts environment variables for a given project and scope.
   * Deletes keys not present in the provided set for the same scope.
   */
  async upsert(
    projectId: string,
    environmentId: string | null,
    vars: Record<string, string>
  ): Promise<void> {
    if (Object.keys(vars).length === 0) {
      throw new ValidationError("At least one variable is required");
    }

    await this.db.$transaction(async (tx) => {
      // Upsert each provided variable using findFirst + create/update
      // because Prisma's compound unique key type doesn't handle nullable fields correctly
      for (const [key, value] of Object.entries(vars)) {
        if (!key) {
          throw new ValidationError("Environment variable key must not be empty");
        }

        const existing = await tx.environmentVariable.findFirst({
          where: { projectId, environmentId, key },
        });

        if (existing) {
          await tx.environmentVariable.update({
            where: { id: existing.id },
            data: { value },
          });
        } else {
          await tx.environmentVariable.create({
            data: { projectId, environmentId, key, value },
          });
        }
      }

      // Delete keys not in the provided set for this scope
      const providedKeys = Object.keys(vars);
      if (providedKeys.length > 0) {
        await tx.environmentVariable.deleteMany({
          where: {
            projectId,
            environmentId,
            key: { notIn: providedKeys },
          },
        });
      }
    });
  }

  /**
   * Deletes a single environment variable by its compound key.
   */
  async delete(projectId: string, environmentId: string | null, key: string): Promise<void> {
    const existing = await this.db.environmentVariable.findFirst({
      where: { projectId, environmentId, key },
    });

    if (!existing) {
      throw new NotFoundError(`Environment variable "${key}" not found for this project`);
    }

    await this.db.environmentVariable.delete({
      where: { id: existing.id },
    });
  }

  /**
   * Gets resolved environment variables for a project and optional environment.
   * Project-level vars (environmentId IS NULL) are merged with environment-specific vars,
   * where environment vars take precedence.
   */
  async getResolvedEnv(projectId: string, environmentId?: string): Promise<Record<string, string>> {
    const allVars = await this.db.environmentVariable.findMany({
      where: { projectId },
      orderBy: { key: "asc" },
    });

    const resolved: Record<string, string> = {};

    // First pass: project-level vars (environmentId === null)
    for (const v of allVars) {
      if (v.environmentId === null) {
        resolved[v.key] = v.value;
      }
    }

    // Second pass: environment-specific vars override project-level
    if (environmentId) {
      for (const v of allVars) {
        if (v.environmentId === environmentId) {
          resolved[v.key] = v.value;
        }
      }
    }

    return resolved;
  }
}
