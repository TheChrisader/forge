import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";

export function setupRoutes(server: FastifyInstance): void {
  registerHealthRoutes(server, server.config);

  // TODO: Add more routes
  // - auth routes
  // - project routes
  // - deployment routes
  // etc.
}
