import type { FastifyInstance } from "fastify";
import { registerHealthRoutes } from "./health.routes.js";
import { registerAuthRoutes } from "./auth.routes.js";
import { registerInvitationRoutes } from "./invitations.routes.js";
import { registerPasswordRoutes } from "./password.routes.js";
import { registerApiKeyRoutes } from "./api-keys.routes.js";
import { registerProjectRoutes } from "./projects.routes.js";
import { registerDeploymentRoutes } from "./deployments.routes.js";
import { registerImageRoutes } from "./images.routes.js";
import { registerContainerRoutes } from "./containers.routes.js";
import { registerSecretRoutes } from "./secrets.routes.js";
import { registerEnvironmentVariableRoutes } from "./environment-variables.routes.js";
import { registerDomainRoutes } from "./domains.routes.js";
import { registerCrlRoutes } from "./crl.routes.js";
import { registerAuditLogRoutes } from "./audit-logs.routes.js";

export function setupRoutes(server: FastifyInstance): void {
  registerHealthRoutes(server, server.config);
  registerCrlRoutes(server, server.config);
  registerAuthRoutes(server, server.config);
  registerInvitationRoutes(server, server.config);
  registerPasswordRoutes(server, server.config);
  registerApiKeyRoutes(server, server.config);
  registerProjectRoutes(server, server.config);
  registerDeploymentRoutes(server, server.config);
  registerImageRoutes(server, server.config);
  registerContainerRoutes(server, server.config);
  registerSecretRoutes(server, server.config);
  registerEnvironmentVariableRoutes(server, server.config);
  registerDomainRoutes(server, server.config);
  registerAuditLogRoutes(server);
}
