import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import crypto from "node:crypto";
import { UnauthorizedError, InternalError } from "@forge/core";
import { createApiKey, requireAuth } from "../middleware/auth.js";
import {
  LoginRequestSchema,
  LoginResponseSchema,
  ApiKeyResponseSchema,
  AuthMeResponseSchema,
} from "@forge/types";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";

export function registerAuthRoutes(_server: FastifyInstance, config: Config): void {
  const server = getTypedFastifyInstance(_server);

  server.post(
    "/api/auth/login",
    {
      schema: {
        body: LoginRequestSchema,
        response: {
          200: LoginResponseSchema,
        },
      },
    },
    (request) => {
      const { email, password } = request.body;

      if (!config.security.admin?.email || !config.security.admin.passwordHash) {
        throw new InternalError("Admin not configured");
      }

      if (email !== config.security.admin.email) {
        throw new UnauthorizedError("Invalid credentials");
      }

      const passwordHash = crypto.createHash("sha256").update(password, "utf-8").digest("hex");

      const storedHashBuffer = Buffer.from(config.security.admin.passwordHash, "utf-8");
      const providedHashBuffer = Buffer.from(passwordHash, "utf-8");

      if (
        storedHashBuffer.length !== providedHashBuffer.length ||
        !crypto.timingSafeEqual(storedHashBuffer, providedHashBuffer)
      ) {
        throw new UnauthorizedError("Invalid credentials");
      }

      const token = server.jwt.sign({
        id: config.security.admin.email,
      });

      return {
        accessToken: token,
        expiresIn: config.security.jwt.expiresIn,
        tokenType: "Bearer" as const,
      };
    }
  );

  server.post(
    "/api/auth/api-keys",
    {
      schema: {
        response: {
          200: ApiKeyResponseSchema,
        },
      },
    },
    (request) => {
      const userId = requireAuth((request as { userId?: string }).userId);

      const key = createApiKey(userId, config.security.jwt.secret);

      const [payloadBase64] = key.split(".");
      const payloadBuffer = Buffer.from(payloadBase64, "base64url");
      const payload = JSON.parse(payloadBuffer.toString("utf-8")) as {
        kid: string;
        createdAt: number;
      };

      return {
        key,
        createdAt: payload.createdAt,
        kid: payload.kid,
      };
    }
  );

  server.get(
    "/api/auth/me",
    {
      schema: {
        response: {
          200: AuthMeResponseSchema,
        },
      },
    },
    (request) => {
      const userId = requireAuth((request as { userId?: string }).userId);

      const authenticatedVia: "jwt" | "api_key" =
        (request as { authenticatedVia?: "jwt" | "api_key" }).authenticatedVia ?? "jwt";

      return {
        userId,
        role: "admin" as "admin" | "user",
        authenticatedVia,
      };
    }
  );
}
