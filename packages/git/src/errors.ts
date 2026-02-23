import { ForgeError } from "@forge/core";

/**
 * Git clone operation failed
 */
export class GitCloneError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("GIT_CLONE_ERROR", 500, message, details);
  }
}

/**
 * Git authentication failed
 */
export class GitAuthError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("GIT_AUTH_ERROR", 401, message, details);
  }
}

/**
 * Git repository not found
 */
export class GitNotFoundError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("GIT_NOT_FOUND", 404, message, details);
  }
}

/**
 * Git network operation failed (timeout, DNS, etc.)
 */
export class GitNetworkError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("GIT_NETWORK_ERROR", 503, message, details);
  }
}
