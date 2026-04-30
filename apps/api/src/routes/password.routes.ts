import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import * as argon2 from "argon2";
import crypto from "node:crypto";
import { BadRequestError } from "@forge/core";
import { ForgotPasswordRequestSchema, ResetPasswordRequestSchema } from "@forge/types";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";

const ARGON2_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const satisfies argon2.Options;

const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000;

export function registerPasswordRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const db = server.db;

  /**
   * POST /api/auth/forgot-password
   */

  // Always returns success to prevent user enumeration. If a user exists and is
  // ACTIVE, a PasswordResetToken is created with a 1-hour expiry.
  server.post(
    "/api/auth/forgot-password",
    {
      schema: {
        tags: ["auth"],
        body: ForgotPasswordRequestSchema,
      },
    },
    async (request) => {
      const body = request.body as { email: string };

      const user = await db.user.findUnique({ where: { email: body.email } });

      if (user && user.status === "ACTIVE") {
        const rawToken = crypto.randomUUID();
        const tokenHash = hashToken(rawToken);

        await db.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() },
        });

        await db.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + RESET_TOKEN_EXPIRY_MS),
          },
        });

        // TODO: Send email with token
      }

      return { success: true };
    }
  );

  /**
   * POST /api/auth/reset-password
   */
  server.post(
    "/api/auth/reset-password",
    {
      schema: {
        tags: ["auth"],
        body: ResetPasswordRequestSchema,
      },
    },
    async (request) => {
      const body = request.body as { token: string; password: string };

      const tokenHash = hashToken(body.token);

      const resetToken = await db.passwordResetToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!resetToken) {
        throw new BadRequestError("Invalid or expired reset token");
      }

      if (resetToken.usedAt) {
        throw new BadRequestError("This reset token has already been used");
      }

      if (resetToken.expiresAt < new Date()) {
        throw new BadRequestError("This reset token has expired");
      }

      if (resetToken.user.status !== "ACTIVE") {
        throw new BadRequestError("Account is not active");
      }

      const passwordHash = await argon2.hash(body.password, ARGON2_HASH_OPTIONS);

      await db.$transaction([
        db.user.update({
          where: { id: resetToken.userId },
          data: { passwordHash },
        }),
        db.passwordResetToken.update({
          where: { id: resetToken.id },
          data: { usedAt: new Date() },
        }),
      ]);

      await db.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    }
  );
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf-8").digest("hex");
}
