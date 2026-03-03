/**
 * Docker image name generation utilities
 *
 * Generates consistent, human-readable Docker image names using project names
 * instead of project IDs.
 *
 * Format: forge/${sanitized-project-name}:${short-deployment-id}
 * Example: forge/my-awesome-app:dpl_0987
 */

/**
 * Sanitizes a project name for use in a Docker image tag.
 * Converts to lowercase, replaces non-alphanumeric sequences with hyphens,
 * and removes leading/trailing hyphens.
 *
 * @param projectName - The raw project name
 * @returns The sanitized project name
 * @throws {Error} If the project name contains no alphanumeric characters
 */
function sanitizeProjectName(projectName: string): string {
  const sanitized = projectName
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (sanitized.length === 0) {
    throw new Error("Project name must contain at least one alphanumeric character");
  }

  return sanitized;
}

/**
 * Generates a Docker image name in the format: forge/${project-name}:${short-deployment-id}
 *
 * The project name is sanitized to be Docker-compatible (lowercase, hyphens for special chars).
 * The deployment ID is shortened to the first 8 characters for brevity while maintaining uniqueness.
 *
 * @param projectName - The project name (will be sanitized)
 * @param deploymentId - The deployment ID (first 8 chars will be used as tag)
 * @returns A Docker image reference string
 * @throws {Error} If the project name cannot be sanitized
 *
 * @example
 * ```ts
 * generateImageName("My Awesome App!", "dpl_1234567890abcdef")
 * // Returns: "forge/my-awesome-app:dpl_12345"
 * ```
 */
export function generateImageName(projectName: string, deploymentId: string): string {
  const sanitizedName = sanitizeProjectName(projectName);
  const shortDeploymentId = deploymentId.substring(0, 8);

  return `forge/${sanitizedName}:${shortDeploymentId}`;
}

/**
 * Generates the tag prefix for image cleanup operations.
 *
 * Returns the image repository prefix that can be used to filter images
 * belonging to a specific project. Useful for pruning old images.
 *
 * @param projectName - The project name (will be sanitized)
 * @returns A Docker image repository prefix (ends with colon)
 * @throws {Error} If the project name cannot be sanitized
 *
 * @example
 * ```ts
 * generateImageTagPrefix("My Awesome App!")
 * // Returns: "forge/my-awesome-app:"
 * ```
 */
export function generateImageTagPrefix(projectName: string): string {
  const sanitizedName = sanitizeProjectName(projectName);
  return `forge/${sanitizedName}:`;
}
