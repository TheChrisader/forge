import type { PrismaClient } from "@forge/database";
import type { Config } from "@forge/core";
import { NotFoundError, ConflictError, ForgeError } from "@forge/core";
import { encrypt, decrypt } from "@forge/security";
import type { ISecretService } from "@forge/core";

function isUniqueConstraintViolation(err: unknown): err is { meta: { target: string[] } } {
  return (
    err instanceof Error &&
    "code" in err &&
    err.code === "P2002" &&
    "meta" in err &&
    typeof err.meta === "object" &&
    err.meta !== null &&
    "target" in err.meta &&
    Array.isArray(err.meta.target)
  );
}

export class SecretService implements ISecretService {
  private readonly encryptionKey: string;

  constructor(
    private readonly db: PrismaClient,
    config: Config
  ) {
    const key = config.security.secrets.encryptionKey;
    if (!key) {
      throw new ForgeError(
        "MISSING_ENCRYPTION_KEY",
        500,
        "Secret encryption key is not configured. Set FORGE_SECURITY__SECRETS__ENCRYPTION_KEY to a string of at least 32 characters."
      );
    }
    this.encryptionKey = key;
  }

  /**
   * Creates a new secret. The value is encrypted before storage.
   */
  async create(data: {
    projectId?: string;
    key: string;
    value: string;
    description?: string;
    createdBy?: string;
  }): Promise<{
    id: string;
    key: string;
    description: string | null;
    projectId: string | null;
    lastAccessedAt: Date | null;
    accessCount: number;
    createdAt: Date;
    updatedAt: Date;
  }> {
    if (!data.key || !data.value) {
      throw new ForgeError(
        "VALIDATION_ERROR",
        400,
        "Both key and value are required when creating a secret"
      );
    }

    const { ciphertext, keyId } = encrypt(data.value, this.encryptionKey);

    try {
      const secret = await this.db.secret.create({
        data: {
          projectId: data.projectId,
          key: data.key,
          encryptedValue: ciphertext,
          encryptionKeyId: keyId,
          description: data.description,
          createdBy: data.createdBy,
        },
      });

      return {
        id: secret.id,
        key: secret.key,
        description: secret.description,
        projectId: secret.projectId,
        lastAccessedAt: null,
        accessCount: 0,
        createdAt: secret.createdAt,
        updatedAt: secret.updatedAt,
      };
    } catch (err) {
      if (isUniqueConstraintViolation(err)) {
        throw new ConflictError(`Secret with key "${data.key}" already exists in this project`);
      }
      throw err;
    }
  }

  /**
   * Updates a secret's value. The new value is encrypted before storage.
   */
  async update(id: string, value: string, updatedBy?: string): Promise<void> {
    const existing = await this.db.secret.findUnique({
      where: { id },
      select: { deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundError("Secret");
    }

    if (existing.deletedAt) {
      throw new NotFoundError("Secret has been deleted");
    }

    const { ciphertext, keyId } = encrypt(value, this.encryptionKey);

    await this.db.secret.update({
      where: { id },
      data: {
        encryptedValue: ciphertext,
        encryptionKeyId: keyId,
        updatedBy: updatedBy ?? null,
      },
    });
  }

  /**
   * Soft-deletes a secret by setting deletedAt.
   */
  async delete(id: string): Promise<void> {
    const existing = await this.db.secret.findUnique({
      where: { id },
      select: { deletedAt: true },
    });

    if (!existing) {
      throw new NotFoundError("Secret");
    }

    if (existing.deletedAt) {
      throw new NotFoundError("Secret has already been deleted");
    }

    await this.db.secret.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  /**
   * Retrieves the decrypted plaintext value of a secret.
   * Atomically increments accessCount and sets lastAccessedAt.
   */
  async get(id: string): Promise<string> {
    const secret = await this.db.secret.findUnique({
      where: { id },
      select: {
        encryptedValue: true,
        deletedAt: true,
      },
    });

    if (!secret) {
      throw new NotFoundError("Secret");
    }

    if (secret.deletedAt) {
      throw new NotFoundError("Secret has been deleted");
    }

    try {
      const plaintext = decrypt(secret.encryptedValue, this.encryptionKey);

      // Bump access tracking (fire-and-forget — don't block on this)
      void this.db.secret.update({
        where: { id },
        data: {
          accessCount: { increment: 1 },
          lastAccessedAt: new Date(),
        },
      });

      return plaintext;
    } catch (err) {
      if (err instanceof ForgeError) {
        throw err;
      }
      throw new ForgeError(
        "DECRYPTION_FAILED",
        500,
        `Failed to decrypt secret: ${err instanceof Error ? err.message : "unknown error"}`
      );
    }
  }

  /**
   * Lists secrets for a project. Returns metadata only — never values.
   * Filters out soft-deleted secrets.
   */
  async list(projectId?: string): Promise<
    Array<{
      id: string;
      key: string;
      description: string | null;
      projectId: string | null;
      lastAccessedAt: Date | null;
      accessCount: number;
      createdAt: Date;
      updatedAt: Date;
    }>
  > {
    const where: {
      deletedAt?: null;
      projectId?: string;
    } = { deletedAt: null };

    if (projectId) {
      where.projectId = projectId;
    }

    const secrets = await this.db.secret.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return secrets.map((s) => ({
      id: s.id,
      key: s.key,
      description: s.description,
      projectId: s.projectId,
      lastAccessedAt: s.lastAccessedAt,
      accessCount: s.accessCount,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));
  }
}
