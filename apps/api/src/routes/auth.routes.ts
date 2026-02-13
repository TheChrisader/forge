import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import crypto from "node:crypto";
import { UnauthorizedError, InternalError } from "@forge/core";
import { createApiKey, requireAuth } from "../middleware/auth.js";

interface LoginRequestBody {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  expiresIn: string;
  tokenType: "Bearer";
}

interface ApiKeyResponse {
  key: string;
  createdAt: number;
  kid: string;
}

interface AuthMeResponse {
  userId: string;
  role: "admin" | "user";
  authenticatedVia: "jwt" | "api_key";
}

export function registerAuthRoutes(server: FastifyInstance, config: Config): void {
  server.post<{
    Body: LoginRequestBody;
    Reply: LoginResponse;
  }>(
    "/api/auth/login",
    {
      schema: {
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              accessToken: { type: "string" },
              expiresIn: { type: "string" },
              tokenType: { type: "string", enum: ["Bearer"] },
            },
          },
        },
      },
    },
    (request): LoginResponse => {
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
        tokenType: "Bearer",
      };
    }
  );

  server.post<{
    Reply: ApiKeyResponse;
  }>(
    "/api/auth/api-keys",
    {
      schema: {
        headers: {
          type: "object",
          properties: {
            authorization: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              key: { type: "string" },
              createdAt: { type: "number" },
              kid: { type: "string" },
            },
          },
        },
      },
    },
    (request): ApiKeyResponse => {
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

  server.get<{
    Reply: AuthMeResponse;
  }>(
    "/api/auth/me",
    {
      schema: {
        headers: {
          type: "object",
          properties: {
            authorization: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              userId: { type: "string" },
              role: { type: "string", enum: ["admin", "user"] },
              authenticatedVia: { type: "string", enum: ["jwt", "api_key"] },
            },
          },
        },
      },
    },
    (request): AuthMeResponse => {
      const userId = requireAuth((request as { userId?: string }).userId);

      const authenticatedVia: "jwt" | "api_key" =
        (request as { authenticatedVia?: "jwt" | "api_key" }).authenticatedVia ?? "jwt";

      return {
        userId,
        role: "admin",
        authenticatedVia,
      };
    }
  );
}
