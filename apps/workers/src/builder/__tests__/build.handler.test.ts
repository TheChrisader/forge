import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BuildJobData } from "@forge/types";
import { ProjectSourceType } from "@forge/types";
import { NoStrategyFoundError } from "@forge/build";
import { GitNotFoundError } from "@forge/git";
import type { IJobContext } from "@forge/queue";

const { mockGitService, mockDb, mockRegistry, mockStrategy, mockFs, MockGitService } = vi.hoisted(
  () => {
    const mockGitService = {
      clone: vi.fn(),
    };

    class MockGitService {
      constructor() {
        return mockGitService;
      }
    }

    return {
      mockGitService,
      MockGitService,
      mockDb: {
        deployment: {
          update: vi.fn(),
        },
        project: {
          update: vi.fn(),
        },
      },
      mockRegistry: {
        detect: vi.fn(),
        get: vi.fn(),
        getAll: vi.fn(),
        register: vi.fn(),
        has: vi.fn(),
      },
      mockStrategy: {
        name: "nodejs",
        detect: vi.fn(),
        build: vi.fn(),
        getDefaultConfig: vi.fn(),
        validateConfig: vi.fn(),
      },
      mockFs: {
        mkdir: vi.fn(),
        rm: vi.fn(),
      },
    };
  }
);

vi.mock("@forge/database", () => ({
  getDatabaseClient: vi.fn(() => mockDb),
}));

vi.mock("@forge/git", async () => {
  const actual = await vi.importActual("@forge/git");
  return {
    ...actual,
    GitService: MockGitService,
  };
});

vi.mock("@forge/build", async () => {
  const actual = await vi.importActual("@forge/build");
  return {
    ...actual,
    registerDefaultStrategies: vi.fn(),
    getBuildStrategyRegistry: vi.fn(() => mockRegistry),
    resetBuildStrategyRegistry: vi.fn(),
  };
});

vi.mock("node:fs/promises", () => mockFs);

import { handleBuildJob } from "../handlers/build.handler.js";

const mockContext: IJobContext<BuildJobData> = {
  job: {
    id: "test-job-1",
    name: "build",
    data: {
      deploymentId: "deploy-123",
      projectId: "project-456",
      sourceType: ProjectSourceType.GIT,
      gitUrl: "https://github.com/test/repo.git",
      branch: "main",
      version: "v1.0.0",
    },
    progress: 0,
    attemptsMade: 0,
    timestamp: Date.now(),
    opts: {},
  },
  updateProgress: vi.fn().mockResolvedValue(undefined),
};

const mockDeployment = {
  id: "deploy-123",
  status: "PENDING",
  projectId: "project-456",
  update: vi.fn(),
};

const mockProject = {
  id: "project-456",
  update: vi.fn(),
};

mockDb.deployment.update.mockResolvedValue(mockDeployment);
mockDb.project.update.mockResolvedValue(mockProject);

mockStrategy.detect.mockResolvedValue({
  detected: true,
  framework: "Node.js",
  confidence: 0.8,
  config: {
    installCommand: "npm ci",
    startCommand: "npm start",
    port: 3000,
  },
});

mockStrategy.build.mockResolvedValue({
  success: true,
  logs: "",
  duration: 0,
});

mockStrategy.getDefaultConfig.mockReturnValue({
  installCommand: "npm ci",
  startCommand: "npm start",
  port: 3000,
});

mockStrategy.validateConfig.mockReturnValue({ valid: true });

mockRegistry.detect.mockResolvedValue(mockStrategy);
mockRegistry.get.mockReturnValue(mockStrategy);
mockRegistry.getAll.mockReturnValue([mockStrategy]);
mockRegistry.has.mockReturnValue(true);

describe("handleBuildJob", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.FORGE_BUILD_DIR = "/tmp/forge-builds-test";
  });

  afterEach(() => {
    delete process.env.FORGE_BUILD_DIR;
  });

  it("should process build job successfully", async () => {
    mockGitService.clone.mockResolvedValue("/tmp/forge-builds-test/deploy-123");

    await handleBuildJob(mockContext);

    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: { status: "BUILDING" },
    });

    expect(mockGitService.clone).toHaveBeenCalledWith({
      url: "https://github.com/test/repo.git",
      branch: "main",
      destinationPath: "/tmp/forge-builds-test/deploy-123",
      depth: 1,
    });

    expect(mockRegistry.detect).toHaveBeenCalled();

    expect(mockDb.project.update).toHaveBeenCalledWith({
      where: { id: "project-456" },
      data: {
        type: "nodejs",
        config: {
          build: {
            buildCommand: undefined,
            installCommand: "npm ci",
            framework: "Node.js",
          },
          runtime: {
            startCommand: "npm start",
            port: 3000,
          },
        },
      },
    });

    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "SUCCEEDED",
        buildCompletedAt: expect.any(Date),
      },
    });
  });

  it("should handle framework detection failure", async () => {
    mockGitService.clone.mockResolvedValue("/tmp/forge-builds-test/deploy-123");
    mockRegistry.detect.mockRejectedValue(new NoStrategyFoundError("project-456"));

    // NoStrategyFoundError is a permanent error, so the handler should NOT throw
    await handleBuildJob(mockContext);

    // Verify deployment was marked as FAILED
    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "FAILED",
        buildCompletedAt: expect.any(Date),
        error: expect.any(String),
      },
    });
  });

  it("should handle git clone failure", async () => {
    mockGitService.clone.mockRejectedValue(new GitNotFoundError("Repository not found"));

    // GitNotFoundError is a permanent error, so the handler should NOT throw
    await handleBuildJob(mockContext);

    expect(mockDb.deployment.update).toHaveBeenCalledWith({
      where: { id: "deploy-123" },
      data: {
        status: "FAILED",
        buildCompletedAt: expect.any(Date),
        error: expect.any(String),
      },
    });
  });

  it("should clean up build directory even on failure", async () => {
    mockGitService.clone.mockRejectedValue(new GitNotFoundError("Repository not found"));

    await handleBuildJob(mockContext);

    expect(mockFs.rm).toHaveBeenCalledWith("/tmp/forge-builds-test/deploy-123", {
      recursive: true,
      force: true,
    });
  });

  it("should use default config when detection returns no config", async () => {
    mockGitService.clone.mockResolvedValue("/tmp/forge-builds-test/deploy-123");

    mockRegistry.detect.mockResolvedValue(mockStrategy);

    mockStrategy.detect.mockResolvedValue({
      detected: true,
      framework: "Node.js",
      confidence: 0.8,
      config: undefined,
    });

    await handleBuildJob(mockContext);

    expect(mockStrategy.getDefaultConfig).toHaveBeenCalled();

    expect(mockDb.project.update).toHaveBeenCalledWith({
      where: { id: "project-456" },
      data: expect.objectContaining({
        config: expect.objectContaining({
          build: expect.objectContaining({
            installCommand: "npm ci",
          }),
          runtime: expect.objectContaining({
            startCommand: "npm start",
            port: 3000,
          }),
        }),
      }),
    });
  });

  it("should pass progress callback to strategy build", async () => {
    mockGitService.clone.mockResolvedValue("/tmp/forge-builds-test/deploy-123");

    await handleBuildJob(mockContext);

    // Verify strategy.build was called with a progress callback as the third argument
    expect(mockStrategy.build).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: "project-456",
        deploymentId: "deploy-123",
      }),
      expect.anything(),
      expect.any(Function)
    );
  });

  it("should call updateProgress when strategy emits progress events", async () => {
    mockGitService.clone.mockResolvedValue("/tmp/forge-builds-test/deploy-123");

    // Make strategy.build call the progress callback
    mockStrategy.build.mockImplementation(async (_context, _config, callback) => {
      await callback?.({
        type: "log",
        message: "Test progress message",
        timestamp: new Date(),
        stage: "test",
      });
      return {
        success: true,
        logs: "",
        duration: 100,
      };
    });

    await handleBuildJob(mockContext);

    // Verify updateProgress was called
    expect(mockContext.updateProgress).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "deployment.log",
        deploymentId: "deploy-123",
        data: expect.objectContaining({
          message: "Test progress message",
        }),
      })
    );
  });
});
