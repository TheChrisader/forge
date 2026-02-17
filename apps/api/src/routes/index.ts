import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerProjectRoutes } from "./projects.routes.js";

export function setupRoutes(server: FastifyInstance): void {
  registerHealthRoutes(server, server.config);
  registerAuthRoutes(server, server.config);
  registerProjectRoutes(server, server.config);

  // TODO: Add more routes
  // - deployment routes
  // etc.
}
