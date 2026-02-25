import { describe, it, expect } from "vitest";
import { BuildErrorClassifier } from "../classifier.js";
import { GitNotFoundError, GitAuthError, GitNetworkError, GitCloneError } from "@forge/git";
import {
  DockerSyntaxError,
  BuildError as DockerBuildError,
  DockerConnectionError,
  DockerDaemonUnavailableError,
} from "@forge/docker";
import { LocalPathNotFoundError, ImageValidationError, ForgeError } from "@forge/core";

describe("BuildErrorClassifier", () => {
  const classifier = new BuildErrorClassifier();

  describe("permanent errors", () => {
    it("should classify GitNotFoundError as non-retryable", () => {
      const error = new GitNotFoundError("repo not found");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify GitAuthError as non-retryable", () => {
      const error = new GitAuthError("authentication failed");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify DockerSyntaxError as non-retryable", () => {
      const error = new DockerSyntaxError("invalid Dockerfile");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify LocalPathNotFoundError as non-retryable", () => {
      const error = new LocalPathNotFoundError("/path/not/found");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify ImageValidationError as non-retryable", () => {
      const error = new ImageValidationError("invalid:image");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify disk space errors in DockerBuildError as non-retryable", () => {
      const error = new DockerBuildError("context", "no space left on device");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify image not found errors in DockerBuildError as non-retryable", () => {
      const error = new DockerBuildError(
        "context",
        "pull access denied and repository does not exist"
      );
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify non-network GitCloneError as non-retryable", () => {
      const error = new GitCloneError("generic clone failure");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });

    it("should classify 4xx ForgeError as non-retryable", () => {
      const error = new ForgeError("CLIENT_ERROR", 400, "Bad request");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(false);
      expect(strategy.deploymentStatus).toBe("FAILED");
    });
  });

  describe("transient errors", () => {
    it("should classify GitNetworkError as retryable", () => {
      const error = new GitNetworkError("network timeout");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify DockerConnectionError as retryable", () => {
      const error = new DockerConnectionError("unix:///var/run/docker.sock", "connection refused");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify DockerDaemonUnavailableError as retryable", () => {
      const error = new DockerDaemonUnavailableError();
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify network-related GitCloneError as retryable", () => {
      const error = new GitCloneError("connection timed out");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify timeout-related GitCloneError as retryable", () => {
      const error = new GitCloneError("operation timed out");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify dns-related GitCloneError as retryable", () => {
      const error = new GitCloneError("dns resolution failed");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify generic DockerBuildError as retryable", () => {
      const error = new DockerBuildError("context", "build failed");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify 5xx ForgeError as retryable", () => {
      const error = new ForgeError("SERVER_ERROR", 500, "Internal server error");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });
  });

  describe("unknown errors", () => {
    it("should classify unknown error as retryable by default", () => {
      const error = new Error("unknown error");
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });

    it("should classify non-Error objects as retryable", () => {
      const error = "string error";
      const strategy = classifier.classify(error);

      expect(strategy.shouldRetry).toBe(true);
      expect(strategy.deploymentStatus).toBe("BUILDING");
    });
  });
});
