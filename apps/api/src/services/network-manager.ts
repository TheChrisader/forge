/**
 * NetworkManager - Handles Docker network management
 *
 * One network per project for isolation.
 * Network naming: forge-project-{projectSlug}-{fullProjectId}
 */

import type { DockerRuntime, Network } from "@forge/docker";
import type { PrismaClient } from "@forge/database";
import type { NamingConfig } from "./container.types";

/**
 * Slugify a string for use in resource names
 * Converts to lowercase, replaces spaces with hyphens, removes special characters
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, 50); // Limit length for resource names
}

/**
 * Default naming configuration
 */
const DEFAULT_NAMING: NamingConfig = {
  networkPrefix: "forge-project",
  volumePrefix: "forge-volume",
  containerPrefix: undefined,
  useProjectSlug: true,
};

export class NetworkManager {
  constructor(
    private readonly runtime: DockerRuntime,
    private readonly db: PrismaClient
  ) {}

  /**
   * Ensures a project network exists
   * Creates if missing, returns existing if present
   *
   * @param projectId - The project UUID
   * @param namingConfig - Optional custom naming configuration
   * @returns The network name that was ensured
   */
  async ensureProjectNetwork(projectId: string, namingConfig?: NamingConfig): Promise<string> {
    const config = { ...DEFAULT_NAMING, ...namingConfig };

    const project = await this.db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    const networkName = this.generateNetworkName(projectId, project.name, config);

    const existingNetworks = await this.runtime.listNetworks({
      name: [networkName],
    });

    if (existingNetworks.length > 0) {
      return networkName;
    }

    await this.runtime.createNetwork({
      name: networkName,
      driver: "bridge",
      internal: false,
      attachable: true,
      labels: {
        "forge.managed": "true",
        "forge.projectId": projectId,
        "forge.type": "project-network",
      },
    });

    return networkName;
  }

  /**
   * Gets all networks for a project
   *
   * @param projectId - The project UUID
   * @returns Array of networks associated with the project
   */
  async getProjectNetworks(projectId: string): Promise<Network[]> {
    const allNetworks = await this.runtime.listNetworks();

    return allNetworks.filter(
      (network) =>
        network.labels?.["forge.projectId"] === projectId &&
        network.labels?.["forge.managed"] === "true"
    );
  }

  /**
   * Removes a project network
   *
   * @param projectId - The project UUID
   * @throws Error if project not found or if network removal fails
   */
  async removeProjectNetwork(projectId: string): Promise<void> {
    const networks = await this.getProjectNetworks(projectId);

    for (const network of networks) {
      try {
        await this.runtime.removeNetwork(network.id);
      } catch (error) {
        // Log but continue - network might be in use by containers
        console.warn(`Failed to remove network ${network.name}:`, error);
        throw new Error(
          `Failed to remove network ${network.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }

  /**
   * Generates a network name for a project
   *
   * @param projectId - The project UUID
   * @param projectName - The project name
   * @param namingConfig - Naming configuration
   * @returns Generated network name
   */
  generateNetworkName(projectId: string, projectName: string, namingConfig?: NamingConfig): string {
    const config = { ...DEFAULT_NAMING, ...namingConfig };
    const prefix = config.networkPrefix || DEFAULT_NAMING.networkPrefix!;
    const slug = config.useProjectSlug !== false ? slugify(projectName) : "";

    if (slug) {
      return `${prefix}-${slug}-${projectId}`;
    }
    return `${prefix}-${projectId}`;
  }

  /**
   * Generates a network name using project lookup
   *
   * @param projectId - The project UUID
   * @param namingConfig - Optional naming configuration
   * @returns Generated network name
   */
  async generateNetworkNameFromProject(
    projectId: string,
    namingConfig?: NamingConfig
  ): Promise<string> {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    return this.generateNetworkName(projectId, project.name, namingConfig);
  }
}
