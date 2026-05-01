import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import crypto from "node:crypto";
import { NotFoundError, BadRequestError } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { z } from "zod";
import { ApiKeyResponseSchema } from "@forge/types";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";

const CreateApiKeyBodySchema = z
  .object({
    name: z.string().min(1).max(255),
    scopes: z.array(z.string()).default([]),
    expiresAt: z.string().datetime().optional(),
  })
  .strict();

export function registerApiKeyRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const db = server.db;

  // Create API key
  server.post(
    "/api/auth/api-keys",
    {
      schema: {
        tags: ["api-keys"],
        body: CreateApiKeyBodySchema,
        response: { 201: ApiKeyResponseSchema },
      },
    },
    async (request) => {
      const userId = requireAuth(request.userId);
      const body = request.body as { name: string; scopes: string[]; expiresAt?: string };

      const prefix = crypto.randomBytes(4).toString("hex"); // 8-char hex prefix
      const randomPart = crypto.randomBytes(32).toString("hex");
      const rawKey = `forge_${prefix}_${randomPart}`;
      const keyHash = hashKey(rawKey);

      const apiKey = await db.apiKey.create({
        data: {
          userId,
          name: body.name,
          prefix,
          keyHash,
          scopes: body.scopes,
          expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        },
      });

      return {
        key: rawKey,
        id: apiKey.id,
        name: apiKey.name,
        prefix: apiKey.prefix,
        scopes: apiKey.scopes,
        expiresAt: apiKey.expiresAt?.toISOString() ?? null,
        createdAt: apiKey.createdAt.toISOString(),
      };
    }
  );

  // List API keys
  server.get(
    "/api/auth/api-keys",
    {
      schema: {
        tags: ["api-keys"],
        response: { 200: ApiKeyResponseSchema.omit({ key: true }).array() },
      },
    },
    async (request) => {
      const userId = requireAuth(request.userId);

      const keys = await db.apiKey.findMany({
        where: {
          userId,
          revokedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });

      return keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        usageCount: k.usageCount ?? 0,
        expiresAt: k.expiresAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      }));
    }
  );

  // Revoke API key
  server.delete(
    "/api/auth/api-keys/:id",
    {
      schema: { tags: ["api-keys"] },
    },
    async (request) => {
      const userId = requireAuth(request.userId);
      const { id } = request.params as { id: string };

      const apiKey = await db.apiKey.findUnique({
        where: { id },
      });

      if (!apiKey) {
        throw new NotFoundError("API key not found");
      }

      if (apiKey.userId !== userId) {
        throw new NotFoundError("API key not found");
      }

      if (apiKey.revokedAt) {
        throw new BadRequestError("API key has already been revoked");
      }

      await db.apiKey.update({
        where: { id: apiKey.id },
        data: { revokedAt: new Date() },
      });

      return { success: true };
    }
  );
}

function hashKey(key: string): string {
  return crypto.createHash("sha256").update(key, "utf-8").digest("hex");
}
