import type { FastifyInstance } from "fastify";
import swagger from "@fastify/swagger";
import swaggerUI from "@fastify/swagger-ui";
import type { Config } from "@forge/core";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
  }
}

export async function setupSwagger(server: FastifyInstance): Promise<void> {
  await server.register(swagger, {
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
        { name: "system", description: "Health and monitoring endpoints" },
        { name: "auth", description: "Authentication and authorization" },
        { name: "projects", description: "Project management" },
        { name: "deployments", description: "Deployment operations" },
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
