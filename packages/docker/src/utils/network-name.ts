/**
 * Shared network naming utility
 *
 * All Forge components that create or reference project networks
 * MUST use this function to ensure consistent naming.
 *
 * Format: forge-project-{slug}-{projectId}
 * Example: forge-project-my-app-a1b2c3d4-e5f6-7890-abcd-ef1234567890
 */

const DEFAULT_PREFIX = "forge-project";
const MAX_SLUG_LENGTH = 50;

/**
 * Converts a string to a slug suitable for Docker resource names.
 * Lowercase, alphanumeric + hyphens, trimmed.
 */
function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .substring(0, MAX_SLUG_LENGTH);
}

/**
 * Generates a canonical network name for a Forge project.
 *
 * @param projectId - The project UUID
 * @param projectName - The project's human-readable name (used to build the slug)
 * @param options.prefix - Custom prefix (default: "forge-project")
 * @returns The canonical network name
 */
export function generateNetworkName(
  projectId: string,
  projectName: string,
  options?: { prefix?: string }
): string {
  const prefix = options?.prefix || DEFAULT_PREFIX;
  const slug = slugify(projectName);

  if (slug) {
    return `${prefix}-${slug}-${projectId}`;
  }
  return `${prefix}-${projectId}`;
}
