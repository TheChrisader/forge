import type { PrismaClient } from "@forge/database";
import crypto from "node:crypto";

interface SessionOptions {
  jwtExpiresIn: string;
  refreshExpiresIn: string;
  jwtSign: (payload: object, options?: { expiresIn?: string }) => string;
}

export class SessionService {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async createRefreshToken(
    userId: string,
    options: SessionOptions,
    meta?: { ipAddress?: string; userAgent?: string; deviceId?: string }
  ): Promise<{ refreshToken: string; tokenHash: string }> {
    const rawToken = crypto.randomUUID();
    const tokenHash = hashToken(rawToken);
    const refreshMs = parseDuration(options.refreshExpiresIn);

    await this.db.refreshToken.create({
      data: {
        userId,
        tokenHash,
        ipAddress: meta?.ipAddress,
        userAgent: meta?.userAgent,
        deviceId: meta?.deviceId,
        expiresAt: new Date(Date.now() + refreshMs),
      },
    });

    return { refreshToken: rawToken, tokenHash };
  }

  async validateRefreshToken(
    rawToken: string
  ): Promise<{ userId: string; tokenId: string } | null> {
    const tokenHash = hashToken(rawToken);

    const stored = await this.db.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      return null;
    }

    return { userId: stored.userId, tokenId: stored.id };
  }

  async rotateRefreshToken(
    tokenId: string,
    options: SessionOptions,
    meta?: { ipAddress?: string; userAgent?: string }
  ): Promise<string> {
    await this.db.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });

    const stored = await this.db.refreshToken.findUnique({
      where: { id: tokenId },
    });

    if (!stored) {
      throw new Error("Refresh token not found during rotation");
    }

    const { refreshToken: newToken } = await this.createRefreshToken(stored.userId, options, meta);
    return newToken;
  }

  async revokeAllForUser(userId: string): Promise<number> {
    const result = await this.db.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return result.count;
  }

  async revokeToken(tokenId: string): Promise<void> {
    await this.db.refreshToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date() },
    });
  }

  async cleanupExpired(): Promise<number> {
    const result = await this.db.refreshToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
        OR: [
          { revokedAt: { not: null } },
          { expiresAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        ],
      },
    });
    return result.count;
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf-8").digest("hex");
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60 * 1000;
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    default:
      return 7 * 24 * 60 * 60 * 1000;
  }
}
