/**
 * VolumeManager - Handles Docker volume management
 *
 * Supports both named volumes and host bind mounts.
 * Volume naming: forge-volume-{projectSlug}-{volumeName}-{fullProjectId}
 */

import type { DockerRuntime, Volume } from "@forge/docker";
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

export class VolumeManager {
  constructor(
    private readonly runtime: DockerRuntime,
    private readonly db: PrismaClient
  ) {}

  /**
   * Ensures a named volume exists
   * Creates if missing, returns existing if present
   *
   * @param config - Volume configuration
   */
  async ensureVolume(config: {
    name: string;
    projectId: string;
    driver?: string;
    labels?: Record<string, string>;
  }): Promise<void> {
    const { name, projectId, driver = "local", labels = {} } = config;

    const existingVolumes = await this.runtime.listVolumes({
      name: [name],
    });

    if (existingVolumes.length > 0) {
      return;
    }

    await this.runtime.createVolume({
      name,
      driver,
      labels: {
        "forge.managed": "true",
        "forge.projectId": projectId,
        "forge.type": "project-volume",
        ...labels,
      },
    });
  }

  /**
   * Generates volume name with customization support
   *
   * @param projectId - The project UUID
   * @param mountPath - The container mount path (used for naming)
   * @param namingConfig - Optional naming configuration
   * @param customName - Optional custom volume name
   * @returns Generated volume name
   */
  generateVolumeName(
    projectId: string,
    mountPath: string,
    namingConfig?: NamingConfig,
    customName?: string
  ): string {
    const config = { ...DEFAULT_NAMING, ...namingConfig };
    const prefix = config.volumePrefix || DEFAULT_NAMING.volumePrefix!;

    if (customName) {
      return customName;
    }

    const pathParts = mountPath.split("/").filter(Boolean);
    const pathSlug = pathParts.slice(-2).join("-");

    return `${prefix}-${pathSlug}-${projectId}`;
  }

  /**
   * Generates volume name using project lookup
   *
   * @param projectId - The project UUID
   * @param mountPath - The container mount path
   * @param namingConfig - Optional naming configuration
   * @param customName - Optional custom volume name
   * @returns Generated volume name
   */
  async generateVolumeNameFromProject(
    projectId: string,
    mountPath: string,
    namingConfig?: NamingConfig,
    customName?: string
  ): Promise<string> {
    const config = { ...DEFAULT_NAMING, ...namingConfig };
    const prefix = config.volumePrefix || DEFAULT_NAMING.volumePrefix!;

    if (customName) {
      return customName;
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId },
      select: { name: true },
    });

    if (!project) {
      throw new Error(`Project with ID ${projectId} not found`);
    }

    const slug = config.useProjectSlug !== false ? slugify(project.name) : "";
    const pathParts = mountPath.split("/").filter(Boolean);
    const pathSlug = pathParts.slice(-2).join("-");

    if (slug) {
      return `${prefix}-${slug}-${pathSlug}-${projectId}`;
    }
    return `${prefix}-${pathSlug}-${projectId}`;
  }

  /**
   * Gets all volumes for a project
   *
   * @param projectId - The project UUID
   * @returns Array of volumes associated with the project
   */
  async getProjectVolumes(projectId: string): Promise<Volume[]> {
    const allVolumes = await this.runtime.listVolumes();

    return allVolumes.filter(
      (volume) =>
        volume.labels?.["forge.projectId"] === projectId &&
        volume.labels?.["forge.managed"] === "true"
    );
  }

  /**
   * Removes all volumes for a project
   *
   * @param projectId - The project UUID
   */
  async removeProjectVolumes(projectId: string): Promise<void> {
    const volumes = await this.getProjectVolumes(projectId);

    for (const volume of volumes) {
      try {
        await this.runtime.removeVolume(volume.name);
      } catch (error) {
        // Log but continue - volume might be in use by containers
        console.warn(`Failed to remove volume ${volume.name}:`, error);
        throw new Error(
          `Failed to remove volume ${volume.name}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }
  }

  /**
   * Ensures all volumes for a container configuration
   *
   * @param volumes - Volume configurations
   * @param projectId - The project UUID
   * @param namingConfig - Optional naming configuration
   * @returns Map of mount paths to volume sources
   */
  async ensureVolumes(
    volumes: Array<{
      mountPath: string;
      volumeName?: string;
      hostPath?: string;
    }>,
    projectId: string,
    namingConfig?: NamingConfig
  ): Promise<Map<string, string>> {
    const volumeMap = new Map<string, string>();

    for (const volumeConfig of volumes) {
      if (volumeConfig.hostPath) {
        volumeMap.set(volumeConfig.mountPath, volumeConfig.hostPath);
        continue;
      }

      const volumeName = await this.generateVolumeNameFromProject(
        projectId,
        volumeConfig.mountPath,
        namingConfig,
        volumeConfig.volumeName
      );

      await this.ensureVolume({
        name: volumeName,
        projectId,
      });

      volumeMap.set(volumeConfig.mountPath, volumeName);
    }

    return volumeMap;
  }
}
