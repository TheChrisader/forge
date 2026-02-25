/**
 * Build-specific error classes
 * Extend the core BuildError with build-domain-specific errors
 */

import { ForgeError, BuildError } from "@forge/core";

export class NoStrategyFoundError extends ForgeError {
  constructor(projectId: string, framework?: string) {
    const message = framework
      ? `No build strategy available for project "${projectId}" (detected framework: ${framework})`
      : `No build strategy available for project "${projectId}". Ensure your project has a recognizable configuration file.`;

    super("NO_STRATEGY_FOUND", 400, message, {
      projectId,
      framework,
      hint: "Supported: Dockerfile, package.json, requirements.txt, go.mod, or index.html",
    });
  }
}

export class BuildValidationError extends ForgeError {
  constructor(message: string, details?: unknown) {
    super("BUILD_VALIDATION_ERROR", 400, `Build configuration validation failed: ${message}`, details);
  }
}

export class BuildExecutionError extends BuildError {
  constructor(
    strategy: string,
    message: string,
    details?: unknown
  ) {
    super(`Build execution failed using "${strategy}" strategy: ${message}`, details);
  }
}
