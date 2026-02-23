/**
 * Git service unit tests
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { GitService } from "../git.service.js";
import { GitAuthError, GitNotFoundError, GitNetworkError } from "../errors.js";
import type { GitCloneOptions } from "../types.js";

// Mock simple-git
vi.mock("simple-git", () => ({
  default: vi.fn(() => ({
    clone: vi.fn(),
    pull: vi.fn(),
    log: vi.fn(),
    branch: vi.fn(),
    branchLocal: vi.fn(),
    checkout: vi.fn(),
    getRemotes: vi.fn(),
  })),
}));

// Mock fs operations
vi.mock("node:fs/promises", () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  unlink: vi.fn(),
}));

// Mock os.tmpdir
vi.mock("node:os", () => ({
  tmpdir: vi.fn(() => process.platform === "win32" ? "C:\\tmp" : "/tmp"),
}));

// Mock path.resolve for consistent test paths
vi.mock("node:path", () => ({
  resolve: vi.fn((path: string) => path),
  dirname: vi.fn((path: string) => {
    const parts = path.split(/[/\\]/);
    parts.pop();
    return parts.join("/");
  }),
  join: vi.fn((...parts: string[]) => parts.join("/")),
}));

// Mock crypto.randomUUID
vi.mock("node:crypto", () => ({
  randomUUID: vi.fn(() => "test-uuid-123"),
}));

describe("GitService", () => {
  let gitService: GitService;

  beforeEach(() => {
    gitService = new GitService();
    vi.clearAllMocks();
  });

  describe("clone", () => {
    const defaultCloneOptions: GitCloneOptions = {
      url: "https://github.com/user/repo.git",
      destinationPath: "/tmp/test-repo",
    };

    it("should clone a public repository successfully", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const result = await gitService.clone(defaultCloneOptions);

      expect(result).toBe("/tmp/test-repo");
      expect(mockGit.clone).toHaveBeenCalled();
    });

    it("should clone with branch option", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const options: GitCloneOptions = {
        ...defaultCloneOptions,
        branch: "develop",
      };

      await gitService.clone(options);

      const cloneArgs = (mockGit.clone as any).mock.calls[0][2];
      expect(cloneArgs).toContain("--branch");
      expect(cloneArgs).toContain("develop");
    });

    it("should clone with depth option for shallow clone", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const options: GitCloneOptions = {
        ...defaultCloneOptions,
        depth: 1,
      };

      await gitService.clone(options);

      const cloneArgs = (mockGit.clone as any).mock.calls[0][2];
      expect(cloneArgs).toContain("--depth");
      expect(cloneArgs).toContain("1");
    });

    it("should throw GitNotFoundError on repository not found", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockRejectedValue({
          message: "repository not found",
          stderr: "ERROR: Repository not found",
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await expect(gitService.clone(defaultCloneOptions)).rejects.toThrow(GitNotFoundError);
    });

    it("should throw GitAuthError on authentication failure", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockRejectedValue({
          message: "authentication failed",
          stderr: "ERROR: Authentication failed",
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await expect(gitService.clone(defaultCloneOptions)).rejects.toThrow(GitAuthError);
    });

    it("should throw GitNetworkError on network timeout", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockRejectedValue({
          message: "connection timed out",
          stderr: "ERROR: Connection timed out",
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await expect(gitService.clone(defaultCloneOptions)).rejects.toThrow(GitNetworkError);
    });

    it("should inject token authentication into URL", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        clone: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const options: GitCloneOptions = {
        ...defaultCloneOptions,
        auth: {
          type: "token",
          credentials: {
            token: "my-secret-token",
          },
        },
      };

      await gitService.clone(options);

      const cloneArgs = (mockGit.clone as any).mock.calls[0][0];
      expect(cloneArgs).toContain("my-secret-token@");
    });

    it("should write and clean up SSH key file for SSH auth", async () => {
      const simpleGit = await import("simple-git");
      const fs = await import("node:fs/promises");
      const mockGit = {
        clone: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const options: GitCloneOptions = {
        ...defaultCloneOptions,
        url: "git@github.com:user/repo.git",
        auth: {
          type: "ssh",
          credentials: {
            privateKey: "-----BEGIN RSA PRIVATE KEY-----\ntest-key\n-----END RSA PRIVATE KEY-----",
          },
        },
      };

      await gitService.clone(options);

      // Verify temp file was written with mode 0600
      expect(fs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining("forge-ssh-key-"),
        expect.stringContaining("-----BEGIN RSA PRIVATE KEY-----"),
        { mode: 0o600 }
      );

      // Verify temp file was cleaned up
      expect(fs.unlink).toHaveBeenCalled();
    });
  });

  describe("getLatestCommit", () => {
    it("should return commit info successfully", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        log: vi.fn().mockResolvedValue({
          latest: {
            hash: "abc123",
            message: "Test commit",
            author_name: "Test Author",
            date: "2024-01-01T00:00:00Z",
          },
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const result = await gitService.getLatestCommit("/tmp/test-repo");

      expect(result).toEqual({
        hash: "abc123",
        message: "Test commit",
        author: "Test Author",
        date: new Date("2024-01-01T00:00:00Z"),
      });
    });

    it("should throw GitNotFoundError when no commits exist", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        log: vi.fn().mockResolvedValue({
          latest: null,
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await expect(gitService.getLatestCommit("/tmp/test-repo")).rejects.toThrow(GitNotFoundError);
    });
  });

  describe("getBranches", () => {
    it("should return list of branch names", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          branches: {
            "origin/main": {},
            "origin/develop": {},
            "origin/feature/test": {},
            "origin/HEAD": {},
          },
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const result = await gitService.getBranches("/tmp/test-repo");

      expect(result).toEqual(["main", "develop", "feature/test"]);
      expect(result).not.toContain("HEAD");
    });

    it("should deduplicate branches", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        branch: vi.fn().mockResolvedValue({
          branches: {
            "origin/main": {},
          },
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const result = await gitService.getBranches("/tmp/test-repo");

      expect(result).toEqual(["main"]);
    });
  });

  describe("checkout", () => {
    it("should checkout existing local branch", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        branchLocal: vi.fn().mockResolvedValue({
          all: ["main", "develop"],
          current: "main",
        }),
        checkout: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await gitService.checkout("/tmp/test-repo", "develop");

      expect(mockGit.checkout).toHaveBeenCalledWith("develop");
    });

    it("should create tracking branch from origin", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        branchLocal: vi.fn().mockResolvedValue({
          all: ["main"],
          current: "main",
        }),
        checkout: vi.fn().mockResolvedValue(undefined),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await gitService.checkout("/tmp/test-repo", "develop");

      expect(mockGit.checkout).toHaveBeenCalledWith(["-b", "develop", "origin/develop"]);
    });
  });

  describe("getRemoteUrl", () => {
    it("should return origin fetch URL", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        getRemotes: vi.fn().mockResolvedValue([
          {
            name: "origin",
            refs: {
              fetch: "https://github.com/user/repo.git",
              push: "https://github.com/user/repo.git",
            },
          },
        ]),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const result = await gitService.getRemoteUrl("/tmp/test-repo");

      expect(result).toBe("https://github.com/user/repo.git");
    });

    it("should throw GitNotFoundError when no origin", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        getRemotes: vi.fn().mockResolvedValue([]),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      await expect(gitService.getRemoteUrl("/tmp/test-repo")).rejects.toThrow(GitNotFoundError);
    });
  });

  describe("getCurrentBranch", () => {
    it("should return current branch name", async () => {
      const simpleGit = await import("simple-git");
      const mockGit = {
        branchLocal: vi.fn().mockResolvedValue({
          all: ["main", "develop"],
          current: "develop",
        }),
      };
      (simpleGit.default as any).mockReturnValue(mockGit);

      const result = await gitService.getCurrentBranch("/tmp/test-repo");

      expect(result).toBe("develop");
    });
  });
});
