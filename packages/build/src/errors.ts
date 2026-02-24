/**
 * Build-specific error classes
 * Extend the core BuildError with build-domain-specific errors
 */

import { BuildError } from "@forge/core";

/**
 * Thrown when the registry cannot find any strategy capable of building the project
 */
export class NoStrategyFoundError extends BuildError {
  constructor(projectId: string, framework?: string) {
    const message = framework
      ? `No build strategy available for project "${projectId}" (detected framework: ${framework})`
      : `No build strategy available for project "${projectId}". Ensure your project has a recognizable configuration file.`;

    super(message, {
      projectId,
      framework,
      hint: "Supported: Dockerfile, package.json, requirements.txt, go.mod, or index.html",
    });
  }
}

/**
 * Thrown when build configuration validation fails
 */
export class BuildValidationError extends BuildError {
  constructor(message: string, details?: unknown) {
    super(`Build configuration validation failed: ${message}`, details);
  }
}

/**
 * Thrown when build execution fails
 */
export class BuildExecutionError extends BuildError {
  constructor(
    strategy: string,
    message: string,
    details?: unknown
  ) {
    super(`Build execution failed using "${strategy}" strategy: ${message}`, details);
  }
}
