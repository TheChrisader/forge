import { describe, it, expect, vi, beforeEach } from "vitest";
import { BuildErrorHandler } from "../handler.js";
import { NoStrategyFoundError } from "@forge/build";
import { GitNotFoundError } from "@forge/git";

const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    deployment: {
      update: vi.fn().mockResolvedValue({}),
    },
    project: {
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock("@forge/database", () => ({
  getDatabaseClient: vi.fn(() => mockDb),
}));

describe("BuildErrorHandler", () => {
  let handler: BuildErrorHandler;

  beforeEach(() => {
    vi.clearAllMocks();
    handler = new BuildErrorHandler();
  });

  const baseContext = {
    deploymentId: "deploy-123",
    projectId: "project-456",
    logger: {
      error: vi.fn(),
      warn: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as any,
    db: mockDb,
  };

  describe("permanent errors (no retry)", () => {
    it("should handle NoStrategyFoundError as permanent failure", async () => {
      const error = new NoStrategyFoundError("project-456");

      await handler.handle({ ...baseContext, error });

      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: expect.objectContaining({
          status: "FAILED",
          buildCompletedAt: expect.any(Date),
        }),
      });

      // Should reset project status
      expect(mockDb.project.update).toHaveBeenCalledWith({
        where: { id: "project-456" },
        data: { status: "ACTIVE" },
      });
    });

    it("should handle GitNotFoundError as permanent failure", async () => {
      const error = new GitNotFoundError("Repository not found");

      await handler.handle({ ...baseContext, error });

      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: expect.objectContaining({
          status: "FAILED",
          buildCompletedAt: expect.any(Date),
        }),
      });
    });

    it("should not re-throw permanent errors", async () => {
      const error = new NoStrategyFoundError("project-456");

      // Should resolve without throwing
      await expect(handler.handle({ ...baseContext, error })).resolves.toBeUndefined();
    });
  });

  describe("transient errors (retry)", () => {
    it("should re-throw transient errors for BullMQ retry", async () => {
      const error = new Error("ETIMEDOUT: connection timed out");

      await expect(handler.handle({ ...baseContext, error })).rejects.toThrow(
        "ETIMEDOUT: connection timed out"
      );

      // Deployment should still be updated
      expect(mockDb.deployment.update).toHaveBeenCalledWith({
        where: { id: "deploy-123" },
        data: expect.objectContaining({
          status: expect.stringMatching(/^(BUILDING|QUEUED)$/),
          buildCompletedAt: null,
        }),
      });
    });

    it("should not set buildCompletedAt for retryable errors", async () => {
      const error = new Error("Network error");

      await expect(handler.handle({ ...baseContext, error })).rejects.toThrow();

      const updateCall = mockDb.deployment.update.mock.calls[0][0];
      expect(updateCall.data.buildCompletedAt).toBeNull();
    });
  });

  describe("database error handling", () => {
    it("should re-throw if database update fails", async () => {
      const error = new NoStrategyFoundError("project-456");
      mockDb.deployment.update.mockRejectedValueOnce(new Error("DB connection lost"));

      await expect(handler.handle({ ...baseContext, error })).rejects.toThrow("DB connection lost");
    });
  });

  describe("non-Error inputs", () => {
    it("should handle string errors", async () => {
      await expect(
        handler.handle({ ...baseContext, error: "something went wrong" })
      ).rejects.toThrow();

      expect(mockDb.deployment.update).toHaveBeenCalled();
    });

    it("should handle unknown error types", async () => {
      await expect(handler.handle({ ...baseContext, error: 42 })).rejects.toThrow();

      expect(mockDb.deployment.update).toHaveBeenCalled();
    });
  });
});
