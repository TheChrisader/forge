import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { existsSync, readFileSync } from "fs";
import { join, resolve } from "path";

/**
 * Resolves a path relative to the project root.
 * The API server runs from apps/api, so relative paths like "./data"
 * would incorrectly resolve to apps/api/data without this correction.
 */
function resolveProjectPath(relativePath: string): string {
  const cwd = process.cwd();

  if (cwd.includes("/apps/") || cwd.includes("\\apps\\")) {
    const appsIndex = Math.max(cwd.lastIndexOf("/apps/"), cwd.lastIndexOf("\\apps\\"));
    const projectRoot = cwd.substring(0, appsIndex);
    return resolve(projectRoot, relativePath);
  }

  return resolve(cwd, relativePath);
}

export function registerCrlRoutes(server: FastifyInstance, config: Config): void {
  server.get(
    "/.well-known/crl/ca.crl",
    {
      schema: { tags: ["system"] },
    },
    async (_request, reply) => {
      const crlPath = join(resolveProjectPath(config.paths.data), "crl", "ca.crl");

      if (!existsSync(crlPath)) {
        return reply
          .status(404)
          .send({ error: "CRL not found. Run pnpm setup:certs to generate." });
      }

      const crlData = readFileSync(crlPath);
      return reply.header("Content-Type", "application/pkix-crl").send(crlData);
    }
  );
}
