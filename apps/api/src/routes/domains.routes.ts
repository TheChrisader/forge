import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { ProxyManagerService } from "../services/proxy-manager.service.js";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import {
  AddDomainRequestSchema,
  DomainResponseSchema,
  AddDomainResponseSchema,
  DomainIdParamsSchema,
  ProjectIdParamsSchema,
  ProxyStatusResponseSchema,
} from "@forge/types";
import { ApiResponseSchema } from "@forge/types";

export function registerDomainRoutes(_server: FastifyInstance, _config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();
  const proxyManager = container.resolveSync<ProxyManagerService>(
    SERVICE_KEY_STRINGS.REVERSE_PROXY
  );

  /**
   * GET /api/projects/:projectId/domains
   * Lists all custom domains for a project
   */
  server.get(
    "/api/projects/:projectId/domains",
    {
      schema: {
        tags: ["domains"],
        params: ProjectIdParamsSchema,
        response: {
          200: ApiResponseSchema(DomainResponseSchema.array()),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "read" });
      const { projectId } = request.params;

      const domains = await proxyManager.getProjectDomains(projectId);

      return reply.status(200).send({ data: domains });
    }
  );

  /**
   * POST /api/projects/:projectId/domains
   * Adds a custom domain to a project
   */
  server.post(
    "/api/projects/:projectId/domains",
    {
      schema: {
        tags: ["domains"],
        params: ProjectIdParamsSchema,
        body: AddDomainRequestSchema,
        response: {
          201: ApiResponseSchema(AddDomainResponseSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { projectId } = request.params;
      const { domain } = request.body;

      const result = await proxyManager.addCustomDomain(projectId, domain);

      return reply.status(201).send({ data: result });
    }
  );

  /**
   * DELETE /api/projects/:projectId/domains/:domainId
   * Removes a custom domain from a project
   */
  server.delete(
    "/api/projects/:projectId/domains/:domainId",
    {
      schema: {
        tags: ["domains"],
        params: DomainIdParamsSchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { domainId } = request.params;

      await proxyManager.removeDomain(domainId);

      return reply.status(204).send();
    }
  );

  /**
   * POST /api/projects/:projectId/domains/:domainId/verify
   * Triggers DNS verification for a custom domain
   */
  server.post(
    "/api/projects/:projectId/domains/:domainId/verify",
    {
      schema: {
        tags: ["domains"],
        params: DomainIdParamsSchema,
        response: {
          200: ApiResponseSchema(DomainResponseSchema),
        },
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "projects", action: "update" });
      const { domainId } = request.params;

      const domain = await proxyManager.verifyDomain(domainId);

      return reply.status(200).send({ data: domain });
    }
  );

  /**
   * GET /api/proxy/status
   * Gets the current proxy status (provider-agnostic)
   */
  server.get(
    "/api/proxy/status",
    {
      schema: {
        tags: ["domains"],
        response: {
          200: ApiResponseSchema(ProxyStatusResponseSchema),
        },
      },
    },
    async (_request, reply) => {
      requireAuth((_request as { userId?: string }).userId);
      const status = await proxyManager.getStatus();

      return reply.status(200).send({ data: status });
    }
  );
}
