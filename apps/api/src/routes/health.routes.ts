import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import Redis from "ioredis";
import { PrismaClient } from "@forge/database";

declare module "fastify" {
  interface FastifyInstance {
    db: PrismaClient;
    redis: Redis;
    config: Config;
  }
}

export function registerHealthRoutes(server: FastifyInstance, _config: Config): void {
  server.get(
    "/health",
    {
      schema: { tags: ["system"] },
    },
    async (_request, _reply) => {
      return { status: "ok", timestamp: new Date().toISOString() };
    }
  );

  server.get(
    "/health/ready",
    {
      schema: { tags: ["system"] },
    },
    async (_request, reply) => {
      const checks: Record<string, { status: string; latencyMs?: number; error?: string }> = {};

      let allHealthy = true;

      try {
        const start = performance.now();
        await server.db.$queryRaw`SELECT 1`;
        const latency = Math.round(performance.now() - start);
        checks.database = { status: "healthy", latencyMs: latency };
      } catch (err) {
        checks.database = {
          status: "unhealthy",
          error: err instanceof Error ? err.message : "Unknown error",
        };
        allHealthy = false;
      }

      try {
        const start = performance.now();
        await server.redis.ping();
        const latency = Math.round(performance.now() - start);
        checks.redis = { status: "healthy", latencyMs: latency };
      } catch (err) {
        checks.redis = {
          status: "unhealthy",
          error: err instanceof Error ? err.message : "Unknown error",
        };
        allHealthy = false;
      }

      const statusCode = allHealthy ? 200 : 503;

      return reply.status(statusCode).send({
        status: allHealthy ? "ready" : "not-ready",
        checks,
      });
    }
  );
}
