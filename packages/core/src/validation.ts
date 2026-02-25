/**
 * Validation patterns and utilities for Forge platform source URLs.
 * Shared between backend and frontend to ensure consistency.
 */

// =============================================================================
// Patterns
// =============================================================================

/**
 * Git URL patterns for HTTPS and SSH formats
 * - HTTPS: https://github.com/user/repo.git
 * - SSH: git@github.com:user/repo.git
 */
export const GIT_URL_PATTERNS = [
  /^https:\/\/[^/\s]+\/[^/\s]+\/[^/\s]+\.git$/,
  /^git@[^:\s]+:[^:\s]+\/[^:\s]+\.git$/,
] as const;

/**
 * Docker image reference pattern
 * - registry.io/image:tag
 * - image:tag
 * - registry.io/namespace/image:tag
 */
export const IMAGE_PATTERN =
  /^[a-z0-9][a-z0-9._-]*[a-z0-9](\/[a-z0-9][a-z0-9._-]*[a-z0-9])?(:[\w][\w.-]*)?$/i;

/**
 * Local filesystem path patterns
 * - Unix: /home/user/projects/myapp
 * - Windows: C:\projects\myapp
 */
export const LOCAL_PATH_PATTERN = /^(\/[\w.~-]+)+|^[a-zA-Z]:\\(?:[\w.~-]+\\?)*$/;

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validates a Git repository URL
 * @param url - The URL to validate
 * @returns true if the URL matches a valid Git URL pattern
 */
export function isValidGitUrl(url: string): boolean {
  return GIT_URL_PATTERNS.some((pattern) => pattern.test(url));
}

/**
 * Validates a Docker image reference
 * @param url - The image reference to validate
 * @returns true if the reference matches a valid image pattern
 */
export function isValidImageUrl(url: string): boolean {
  return IMAGE_PATTERN.test(url);
}

/**
 * Validates a local filesystem path
 * @param url - The path to validate
 * @returns true if the path matches a valid local path pattern
 */
export function isValidLocalPath(url: string): boolean {
  return LOCAL_PATH_PATTERN.test(url);
}

/**
 * Validates a source URL based on its type
 * @param url - The URL to validate
 * @param sourceType - The type of source ("git" | "local" | "image" | "docker-compose")
 * @returns true if the URL is valid for the given source type
 */
export function isValidSourceUrl(
  url: string,
  sourceType: "git" | "local" | "image" | "docker-compose"
): boolean {
  switch (sourceType) {
    case "git":
      return isValidGitUrl(url);
    case "image":
      return isValidImageUrl(url);
    case "local":
    case "docker-compose":
      return isValidLocalPath(url);
    default:
      return false;
  }
}
