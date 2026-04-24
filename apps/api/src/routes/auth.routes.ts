import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import crypto from "node:crypto";
import * as argon2 from "argon2";
import { UnauthorizedError, ForbiddenError, InternalError } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import {
  LoginRequestSchema,
  LoginResponseSchema,
  RefreshTokenRequestSchema,
  RefreshTokenResponseSchema,
  AuthMeResponseSchema,
  ChangePasswordRequestSchema,
  UpdateProfileRequestSchema,
} from "@forge/types";
import type { AuthMeResponse } from "@forge/types";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import type { PrismaClient } from "@forge/database";

const ARGON2_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const satisfies argon2.Options;

export function registerAuthRoutes(_server: FastifyInstance, config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const db = server.db;

  server.post(
    "/api/auth/login",
    {
      schema: {
        body: LoginRequestSchema,
        response: { 200: LoginResponseSchema },
      },
    },
    async (request) => {
      const { email, password } = request.body;

      const user = await db.user.findUnique({ where: { email } });

      if (!user || !user.passwordHash) {
        // Fall back to env-var admin if no users exist
        if (!user && config.security.admin?.email && config.security.admin.passwordHash) {
          const userCount = await db.user.count();
          if (userCount === 0) {
            return await handleLegacyLogin(email, password, config, db, server);
          }
        }
        throw new UnauthorizedError("Invalid credentials");
      }

      if (user.status !== "ACTIVE") {
        throw new ForbiddenError("Account is not active");
      }

      const valid = await argon2.verify(user.passwordHash, password);
      if (!valid) {
        throw new UnauthorizedError("Invalid credentials");
      }

      await db.user.update({
        where: { id: user.id },
        data: {
          lastLoginAt: new Date(),
          loginCount: { increment: 1 },
        },
      });

      return issueTokenPair(db, user.id, user.email, request, config, server);
    }
  );

  server.post(
    "/api/auth/refresh",
    {
      schema: {
        body: RefreshTokenRequestSchema,
        response: { 200: RefreshTokenResponseSchema },
      },
    },
    async (request) => {
      const body = request.body as { refreshToken: string };

      const tokenHash = hashToken(body.refreshToken);

      const stored = await db.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: true },
      });

      if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
        throw new UnauthorizedError("Invalid or expired refresh token");
      }

      if (stored.user.status !== "ACTIVE") {
        throw new ForbiddenError("Account is not active");
      }

      await db.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      });

      return issueTokenPair(db, stored.user.id, stored.user.email, request, config, server);
    }
  );

  server.post(
    "/api/auth/change-password",
    {
      schema: { body: ChangePasswordRequestSchema },
    },
    async (request) => {
      const userId = requireAuth(request.userId);
      const body = request.body as { currentPassword: string; newPassword: string };

      const user = await db.user.findUnique({ where: { id: userId } });
      if (!user || !user.passwordHash) {
        throw new UnauthorizedError("User not found or has no password set");
      }

      const valid = await argon2.verify(user.passwordHash, body.currentPassword);
      if (!valid) {
        throw new UnauthorizedError("Current password is incorrect");
      }

      const newHash = await argon2.hash(body.newPassword, ARGON2_HASH_OPTIONS);

      await db.user.update({
        where: { id: userId },
        data: { passwordHash: newHash },
      });

      await db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    }
  );

  server.get(
    "/api/auth/me",
    {
      schema: { response: { 200: AuthMeResponseSchema } },
    },
    async (request) => {
      const userId = requireAuth(request.userId);
      const authenticatedVia =
        (request as { authenticatedVia?: "jwt" | "api_key" }).authenticatedVia ?? "jwt";
      return buildAuthMeResponse(db, userId, authenticatedVia);
    }
  );

  server.patch(
    "/api/auth/me",
    {
      schema: {
        body: UpdateProfileRequestSchema,
        response: { 200: AuthMeResponseSchema },
      },
    },
    async (request) => {
      const userId = requireAuth(request.userId);
      const body = request.body as { name?: string; email?: string };

      const data: { name?: string; email?: string } = {};
      if (body.name !== undefined) data.name = body.name;
      if (body.email !== undefined) data.email = body.email;

      await db.user.update({
        where: { id: userId },
        data,
      });

      const authenticatedVia =
        (request as { authenticatedVia?: "jwt" | "api_key" }).authenticatedVia ?? "jwt";
      return buildAuthMeResponse(db, userId, authenticatedVia);
    }
  );
}

async function buildAuthMeResponse(
  db: PrismaClient,
  userId: string,
  authenticatedVia: "jwt" | "api_key"
): Promise<AuthMeResponse> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      teamMemberships: {
        include: { team: true },
      },
      roleAssignments: {
        include: {
          role: {
            include: { permissions: { include: { permission: true } } },
          },
        },
      },
    },
  });

  if (!user) {
    throw new UnauthorizedError("User not found");
  }

  const teams = user.teamMemberships.map((m) => ({
    id: m.team.id,
    name: m.team.name,
    slug: m.team.slug,
    role: m.role,
  }));

  const allPermissions = new Set<string>();
  let isAdmin = false;

  for (const assignment of user.roleAssignments) {
    if (assignment.role.isSystem && assignment.role.name === "platform_admin") {
      isAdmin = true;
      allPermissions.add("admin");
      break;
    }
    for (const rp of assignment.role.permissions) {
      allPermissions.add(`${rp.permission.resource}:${rp.permission.action}`);
    }
  }

  const currentTeamId = teams.length > 0 ? teams[0].id : null;

  const result = AuthMeResponseSchema.safeParse({
    userId: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    role: isAdmin ? "admin" : "user",
    authenticatedVia,
    teams,
    currentTeamId,
    permissions: [...allPermissions],
  });

  if (result.error) {
    throw new InternalError("Error fetching user");
  }

  return result.data;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
  tokenType: "Bearer";
}

function issueTokenPair(
  db: PrismaClient,
  userId: string,
  email: string,
  request: { ip: string; headers: Record<string, unknown> },
  config: Config,
  server: { jwt: { sign: (payload: object, options?: { expiresIn?: string }) => string } }
): TokenPair {
  const accessToken = server.jwt.sign(
    { id: userId, email },
    { expiresIn: config.security.jwt.expiresIn }
  );

  const refreshTokenRaw = crypto.randomUUID();
  const tokenHash = hashToken(refreshTokenRaw);
  const refreshMs = parseDuration(config.security.jwt.refreshExpiresIn);

  // Fire-and-forget: we don't await this to keep the login response fast.
  // The refresh token is written to DB asynchronously.
  void db.refreshToken.create({
    data: {
      userId,
      tokenHash,
      ipAddress: request.ip,
      userAgent: getUserAgent(request.headers),
      expiresAt: new Date(Date.now() + refreshMs),
    },
  });

  return {
    accessToken,
    refreshToken: refreshTokenRaw,
    expiresIn: config.security.jwt.expiresIn,
    tokenType: "Bearer",
  };
}

/**
 * Handles legacy env-var admin login when no users exist in the database.
 * Creates a User record from env vars so subsequent logins go through the DB path.
 */
async function handleLegacyLogin(
  email: string,
  password: string,
  config: Config,
  db: PrismaClient,
  server: { jwt: { sign: (payload: object, options?: { expiresIn?: string }) => string } }
): Promise<TokenPair> {
  if (email !== config.security.admin!.email) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const passwordHash = crypto.createHash("sha256").update(password, "utf-8").digest("hex");
  const storedHashBuffer = Buffer.from(config.security.admin!.passwordHash, "utf-8");
  const providedHashBuffer = Buffer.from(passwordHash, "utf-8");

  if (
    storedHashBuffer.length !== providedHashBuffer.length ||
    !crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer)
  ) {
    throw new UnauthorizedError("Invalid credentials");
  }

  const secureHash = await argon2.hash(password, ARGON2_HASH_OPTIONS);

  const user = await db.user.create({
    data: {
      email: config.security.admin!.email,
      name: "Admin",
      passwordHash: secureHash,
      status: "ACTIVE",
      lastLoginAt: new Date(),
      loginCount: 1,
    },
  });

  await db.team.create({
    data: {
      name: "Default",
      slug: "default",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  const platformAdmin = await db.role.upsert({
    where: { name: "platform_admin" },
    update: {},
    create: {
      name: "platform_admin",
      description: "Full access to all platform resources",
      isSystem: true,
    },
  });

  await db.roleAssignment.create({
    data: {
      userId: user.id,
      roleId: platformAdmin.id,
    },
  });

  return issueTokenPair(db, user.id, user.email, { ip: "0.0.0.0", headers: {} }, config, server);
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf-8").digest("hex");
}

function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) {
    return 7 * 24 * 60 * 60 * 1000; // default 7 days
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
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

function getUserAgent(headers: Record<string, unknown>): string | null {
  const ua = headers["user-agent"];
  return typeof ua === "string" ? ua : null;
}
