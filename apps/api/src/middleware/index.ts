import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import { ValidationError, isForgeError, RateLimitError, InternalError } from "@forge/core";
import { verifyApiKey } from "./auth.js";

export async function setupMiddleware(server: FastifyInstance, config: Config): Promise<void> {
  if (config.server.cors.enabled) {
    await server.register(cors, {
      origin: config.server.cors.origins,
      credentials: config.server.cors.credentials,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    });
  }

  await server.register(compress, {
    encodings: ["gzip", "deflate"],
  });

  // Important: req.userId will be undefined for unauthenticated requests
  // because the auth hook hasn't run yet. This IP fallback is intentional.
  if (config.server.rateLimit.enabled) {
    await server.register(rateLimit, {
      max: config.server.rateLimit.max,
      timeWindow: config.server.rateLimit.windowMs,
      keyGenerator: (req) => {
        return (req as { userId?: string }).userId ?? req.ip;
      },
      errorResponseBuilder: (_req, context) => {
        return {
          error: new RateLimitError("Rate limit exceeded", {
            limit: context.max,
            reset: context.after,
          }).toJSON(),
        };
      },
    });
  }

  await server.register(jwt, {
    secret: config.security.jwt.secret,
    sign: {
      expiresIn: config.security.jwt.expiresIn,
    },
  });

  // Auth hook - tries JWT first, falls back to API key
  // This hook never throws - unauthenticated requests are allowed through
  // Routes decide if they need auth via requireAuth()
  server.addHook("onRequest", async (request) => {
    try {
      await request.jwtVerify();
      (request as { userId?: string; authenticatedVia?: "jwt" | "api_key" }).userId = (
        request.user as { id: string }
      ).id;
      (request as { userId?: string; authenticatedVia?: "jwt" | "api_key" }).authenticatedVia =
        "jwt";
    } catch {
      const apiKeyHeader = config.security.apiKey?.header ?? "x-api-key";
      const apiKey = request.headers[apiKeyHeader];

      if (typeof apiKey === "string") {
        const payload = verifyApiKey(apiKey, config.security.jwt.secret);

        if (payload) {
          (request as { userId?: string; authenticatedVia?: "jwt" | "api_key" }).userId =
            payload.userId;
          (request as { userId?: string; authenticatedVia?: "jwt" | "api_key" }).authenticatedVia =
            "api_key";
        }
      }
    }
  });

  server.addHook("onRequest", async (request, reply) => {
    const startTime = Date.now();

    reply.raw.on("finish", () => {
      const duration = Date.now() - startTime;
      const userId = (request as { userId?: string }).userId;

      if (config.nodeEnv === "production") {
        server.logger.info("", {
          method: request.method,
          url: request.url,
          status: reply.statusCode,
          duration: `${duration}ms`,
          userId: userId ?? "anonymous",
          ip: request.ip,
        });
      } else {
        server.logger.info(
          `[${request.method}] ${request.url} ${reply.statusCode} ${duration}ms (user: ${userId ?? "anonymous"})`
        );
      }
    });
  });

  server.setErrorHandler(async (error, request, reply) => {
    const err = error as { validation?: unknown[]; statusCode?: number };

    if (err.validation) {
      const validationError = new ValidationError("Request validation failed", {
        errors: err.validation,
        method: request.method,
        url: request.url,
      });

      return reply.status(validationError.statusCode).send({ error: validationError.toJSON() });
    }

    if (isForgeError(error)) {
      const forgeError = error;
      if (forgeError.statusCode === 500 && config.nodeEnv === "production") {
        const internalError = new InternalError("An internal error occurred");
        return reply.status(500).send({ error: internalError.toJSON() });
      }

      return reply.status(forgeError.statusCode).send({ error: forgeError.toJSON() });
    }

    if (err.statusCode === 429) {
      const rateLimitError = new RateLimitError("Rate limit exceeded");
      return reply.status(429).send({ error: rateLimitError.toJSON() });
    }

    server.logger.error("Unexpected error", { err: error });
    const internalError = new InternalError(
      config.nodeEnv === "production"
        ? "An internal error occurred"
        : ((error as Error).message ?? "Unknown error")
    );
    return reply.status(500).send({ error: internalError.toJSON() });
  });

  server.setNotFoundHandler(async (request, reply) => {
    const notFoundError = new ValidationError("Resource not found", {
      method: request.method,
      url: request.url,
    });
    return reply.status(404).send({ error: notFoundError.toJSON() });
  });
}
