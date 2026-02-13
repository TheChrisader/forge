import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import cors from "@fastify/cors";
import compress from "@fastify/compress";
import rateLimit from "@fastify/rate-limit";

export async function setupMiddleware(server: FastifyInstance, config: Config): Promise<void> {
  if (config.server.cors.enabled) {
    await server.register(cors, {
      origin: config.server.cors.origins,
      credentials: config.server.cors.credentials,
    });
  }

  await server.register(compress, {
    encodings: ["gzip", "deflate"],
  });

  if (config.server.rateLimit.enabled) {
    await server.register(rateLimit, {
      max: config.server.rateLimit.max,
      timeWindow: config.server.rateLimit.windowMs,
    });
  }
}
