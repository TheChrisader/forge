import type { ErrorHandlingStrategy } from "./types.js";
import {
  // Git errors from @forge/git
  GitNotFoundError,
  GitAuthError,
  GitNetworkError,
  GitCloneError,
} from "@forge/git";
import {
  // Docker errors from @forge/docker
  DockerSyntaxError,
  BuildError as DockerBuildError,
  DockerConnectionError,
  DockerDaemonUnavailableError,
} from "@forge/docker";
import {
  // Core errors from @forge/core
  LocalPathNotFoundError,
  ImageValidationError,
  ForgeError,
} from "@forge/core";

/**
 * Categorizes build errors into retryable (transient) vs non-retryable (permanent)
 *
 * Permanent errors: No amount of retrying will help
 * - Auth failures (401)
 * - Not found (404)
 * - Syntax errors in Dockerfile
 * - Invalid configuration
 *
 * Transient errors: May succeed on retry
 * - Network timeouts
 * - DNS failures
 * - Docker daemon temporarily unavailable
 * - Rate limiting (429)
 */
export class BuildErrorClassifier {
  classify(error: unknown): ErrorHandlingStrategy {
    // Permanent errors - fail immediately
    if (error instanceof GitNotFoundError) {
      return {
        shouldRetry: false,
        userMessage: "Repository not found. Verify the git URL is correct.",
        logLevel: "error",
        deploymentStatus: "FAILED",
      };
    }

    if (error instanceof GitAuthError) {
      return {
        shouldRetry: false,
        userMessage: "Authentication failed. Check repository access credentials.",
        logLevel: "error",
        deploymentStatus: "FAILED",
      };
    }

    if (error instanceof DockerSyntaxError) {
      return {
        shouldRetry: false,
        userMessage: "Dockerfile syntax error. Fix the Dockerfile and redeploy.",
        logLevel: "error",
        deploymentStatus: "FAILED",
      };
    }

    if (error instanceof LocalPathNotFoundError) {
      return {
        shouldRetry: false,
        userMessage: `Local path not found: ${(error as LocalPathNotFoundError).message}`,
        logLevel: "error",
        deploymentStatus: "FAILED",
      };
    }

    if (error instanceof ImageValidationError) {
      return {
        shouldRetry: false,
        userMessage: `Invalid image reference: ${(error as ImageValidationError).message}`,
        logLevel: "error",
        deploymentStatus: "FAILED",
      };
    }

    // Transient errors - retry with queue backoff
    if (error instanceof GitNetworkError) {
      return {
        shouldRetry: true,
        userMessage: "Network error cloning repository. Retrying...",
        logLevel: "warn",
        deploymentStatus: "BUILDING", // Keep building so retry happens
      };
    }

    if (error instanceof DockerConnectionError || error instanceof DockerDaemonUnavailableError) {
      return {
        shouldRetry: true,
        userMessage: "Docker daemon unavailable. Retrying...",
        logLevel: "warn",
        deploymentStatus: "BUILDING",
      };
    }

    // Docker build errors - inspect message to determine retryability
    if (error instanceof DockerBuildError) {
      const message = error.message.toLowerCase();

      // Disk space - permanent (admin action required)
      if (message.includes("no space left") || message.includes("disk full")) {
        return {
          shouldRetry: false,
          userMessage: "Out of disk space. Contact administrator to free up space.",
          logLevel: "error",
          deploymentStatus: "FAILED",
        };
      }

      // Base image pull failures - transient (network)
      if (message.includes("pull access denied") && message.includes("repository does not exist")) {
        return {
          shouldRetry: false,
          userMessage: `Base image not found. Check image name in Dockerfile.`,
          logLevel: "error",
          deploymentStatus: "FAILED",
        };
      }

      // Generic build error - assume transient for retry
      return {
        shouldRetry: true,
        userMessage: "Build failed, may be transient. Retrying...",
        logLevel: "warn",
        deploymentStatus: "BUILDING",
      };
    }

    // Generic clone error - inspect for retryable indicators
    if (error instanceof GitCloneError) {
      const message = error.message.toLowerCase();

      if (
        message.includes("timeout") ||
        message.includes("timed out") ||
        message.includes("network") ||
        message.includes("connection") ||
        message.includes("dns")
      ) {
        return {
          shouldRetry: true,
          userMessage: "Network error during git clone. Retrying...",
          logLevel: "warn",
          deploymentStatus: "BUILDING",
        };
      }

      // Other clone errors - assume permanent
      return {
        shouldRetry: false,
        userMessage: `Git clone failed: ${error.message}`,
        logLevel: "error",
        deploymentStatus: "FAILED",
      };
    }

    // Unknown ForgeError - inspect status code
    if (error instanceof ForgeError) {
      const statusCode = (error as ForgeError).statusCode;

      // 4xx errors (client errors) are permanent
      if (statusCode >= 400 && statusCode < 500) {
        return {
          shouldRetry: false,
          userMessage: error.message,
          logLevel: "error",
          deploymentStatus: "FAILED",
        };
      }

      // 5xx errors (server errors) are transient
      return {
        shouldRetry: true,
        userMessage: "Server error occurred. Retrying...",
        logLevel: "warn",
        deploymentStatus: "BUILDING",
      };
    }

    // Unknown error - conservative: retry a few times
    return {
      shouldRetry: true,
      userMessage: "Unexpected error occurred. Retrying...",
      logLevel: "error",
      deploymentStatus: "BUILDING",
    };
  }
}
