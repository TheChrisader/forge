import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import { jsonSchemaTransform } from "fastify-type-provider-zod";
import type { Config } from "@forge/core";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
  }
}

export async function setupSwagger(server: FastifyInstance): Promise<void> {
  await server.register(swagger, {
    transform: jsonSchemaTransform,
    openapi: {
      openapi: "3.1.0",
      info: {
        title: "Forge API",
        description: "Local-first application deployment platform",
        version: "0.1.0",
        contact: {
          name: "Forge Platform",
        },
      },
      servers: [
        {
          url: `http://${server.config.server.host}:${server.config.server.port}`,
          description: "Development server",
        },
      ],
      tags: [
        { name: "system", description: "Health, monitoring, and infrastructure endpoints" },
        { name: "auth", description: "Authentication and authorization" },
        { name: "projects", description: "Project management" },
        { name: "deployments", description: "Deployment operations" },
        { name: "containers", description: "Container lifecycle and management" },
        { name: "images", description: "Docker image management" },
        { name: "services", description: "Managed service provisioning and lifecycle" },
        { name: "domains", description: "Custom domain and proxy management" },
        { name: "environment", description: "Environment variable management" },
        { name: "secrets", description: "Encrypted secret management" },
        { name: "api-keys", description: "API key management" },
        { name: "invitations", description: "Team invitations and registration" },
        { name: "audit-logs", description: "Audit log queries" },
        { name: "dashboard", description: "Dashboard and aggregated statistics" },
        { name: "alerts", description: "Alerts, rules, and notification channels" },
        { name: "push", description: "Push notification subscriptions" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          apiKey: {
            type: "apiKey",
            in: "header",
            name: server.config.security.apiKey?.header || "x-api-key",
          },
        },
      },
    },
  });

  await server.register(swaggerUI, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: true,
      persistAuthorization: true,
    },
  });
}
