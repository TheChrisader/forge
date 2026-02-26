import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerProjectRoutes } from "./projects.routes.js";
import { registerDeploymentRoutes } from "./deployments.routes.js";
import { registerImageRoutes } from "./images.routes.js";
import { registerContainerRoutes } from "./containers.routes.js";

export function setupRoutes(server: FastifyInstance): void {
  registerHealthRoutes(server, server.config);
  registerAuthRoutes(server, server.config);
  registerProjectRoutes(server, server.config);
  registerDeploymentRoutes(server, server.config);
  registerImageRoutes(server, server.config);
  registerContainerRoutes(server, server.config);
}
