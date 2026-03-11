/**
 * Git service for repository operations
 * Wraps simple-git with Forge-specific error handling and auth support
 */

import * as fs from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import simpleGit, { SimpleGit } from "simple-git";
import type {
  GitCloneOptions,
  GitPullOptions,
  GitAuth,
  CommitInfo,
  GitProgressCallback,
} from "./types.js";
import { GitCloneError, GitAuthError, GitNotFoundError, GitNetworkError } from "./errors.js";

const CLONE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Git error with stderr property
 */
interface GitErrorWithStderr extends Error {
  stderr?: string;
}

/**
 * Parse git error and return appropriate Forge error
 */
function parseGitError(error: Error): Error {
  const gitError = error as GitErrorWithStderr;
  const stderr = gitError.stderr?.toLowerCase() ?? "";
  const message = error.message?.toLowerCase() ?? "";

  // Check for repository not found
  if (
    stderr.includes("repository not found") ||
    stderr.includes("could not read from remote") ||
    message.includes("repository not found")
  ) {
    return new GitNotFoundError("Git repository not found or inaccessible", {
      originalError: error.message,
    });
  }

  // Check for authentication failures
  if (
    stderr.includes("authentication failed") ||
    stderr.includes("permission denied") ||
    stderr.includes("invalid credentials") ||
    stderr.includes("could not authenticate") ||
    message.includes("authentication failed")
  ) {
    return new GitAuthError("Git authentication failed", { originalError: error.message });
  }

  // Check for network errors
  if (
    stderr.includes("could not resolve host") ||
    stderr.includes("connection timed out") ||
    stderr.includes("network is unreachable") ||
    stderr.includes("connect failed") ||
    message.includes("could not resolve") ||
    message.includes("timed out")
  ) {
    return new GitNetworkError("Git operation failed due to network error", {
      originalError: error.message,
    });
  }

  // Generic clone error
  return new GitCloneError("Git operation failed", { originalError: error.message });
}

/**
 * Inject authentication into git URL
 */
function injectAuth(url: string, auth: GitAuth): string {
  try {
    const urlObj = new URL(url);

    switch (auth.type) {
      case "token":
        urlObj.username = auth.credentials?.token ?? "";
        urlObj.password = ""; // Token-only auth
        break;
      case "basic":
        urlObj.username = auth.credentials?.username ?? "";
        urlObj.password = auth.credentials?.password ?? "";
        break;
      case "ssh":
        // SSH auth is handled separately via temp key file
        return url;
    }

    return urlObj.toString();
  } catch {
    // If URL parsing fails, return original
    return url;
  }
}

/**
 * GitService provides a clean interface for git operations
 */
export class GitService {
  private async createSshKeyEnv(privateKey: string): Promise<string> {
    const tmpDir = os.tmpdir();
    const keyFilename = `forge-ssh-key-${crypto.randomUUID()}`;
    const keyPath = path.join(tmpDir, keyFilename);

    await fs.writeFile(keyPath, privateKey, { mode: 0o600 });

    return keyPath;
  }

  private async removeSshKeyFile(keyPath: string): Promise<void> {
    try {
      await fs.unlink(keyPath);
    } catch {
      // Ignore errors when cleaning up
    }
  }

  private getSshCommandEnv(keyPath?: string): Record<string, string> {
    if (keyPath) {
      return {
        GIT_SSH_COMMAND: `ssh -i ${keyPath} -o IdentitiesOnly=yes -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`,
      };
    }
    return process.env as Record<string, string>;
  }

  async clone(options: GitCloneOptions): Promise<string> {
    const { url, branch, depth, destinationPath, auth, onProgress } = options;

    // Emit auth setup progress
    if (auth) {
      void onProgress?.({
        type: "stage",
        message: `Configuring ${auth.type} authentication...`,
        timestamp: new Date(),
        stage: "git-auth",
      });
    }

    let effectiveUrl = url;
    if (auth && auth.type !== "ssh") {
      effectiveUrl = injectAuth(url, auth);
    }

    let sshKeyPath: string | undefined;
    if (auth?.type === "ssh" && auth.credentials?.privateKey) {
      sshKeyPath = await this.createSshKeyEnv(auth.credentials.privateKey);
      void onProgress?.({
        type: "log",
        message: "SSH key configured",
        timestamp: new Date(),
        stage: "git-auth",
      });
    }

    try {
      const parentDir = path.dirname(destinationPath);
      await fs.mkdir(parentDir, { recursive: true });
      void onProgress?.({
        type: "log",
        message: "Starting clone operation...",
        timestamp: new Date(),
        stage: "git-clone",
      });

      const git: SimpleGit = simpleGit({
        baseDir: parentDir,
        progress: (data) => {
          // Forward simple-git progress to onProgress
          if (data.stage) {
            void onProgress?.({
              type: "log",
              message: `Git: ${data.stage}${data.progress ? ` (${data.progress}%)` : ""}`,
              timestamp: new Date(),
              stage: "git-clone",
              progress: data.progress ? Number(data.progress) : undefined,
            });
          }
        },
        timeout: {
          block: CLONE_TIMEOUT_MS,
        },
      });

      const sshEnv = this.getSshCommandEnv(sshKeyPath);

      const cloneOptions: string[] = [];
      if (branch) {
        cloneOptions.push("--branch", branch);
      }
      if (depth) {
        cloneOptions.push("--depth", depth.toString());
      }

      const originalEnv = { ...process.env };
      if (sshEnv.GIT_SSH_COMMAND) {
        process.env.GIT_SSH_COMMAND = sshEnv.GIT_SSH_COMMAND;
      }

      try {
        await Promise.race([
          git.clone(effectiveUrl, destinationPath, cloneOptions),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("Clone timeout")), CLONE_TIMEOUT_MS)
          ),
        ]);
      } finally {
        if (sshEnv.GIT_SSH_COMMAND) {
          if (originalEnv.GIT_SSH_COMMAND) {
            process.env.GIT_SSH_COMMAND = originalEnv.GIT_SSH_COMMAND;
          } else {
            delete process.env.GIT_SSH_COMMAND;
          }
        }
      }

      // Emit completion
      void onProgress?.({
        type: "complete",
        message: "Repository cloned successfully",
        timestamp: new Date(),
        stage: "git-clone",
        progress: 100,
      });

      return path.resolve(destinationPath);
    } catch (error) {
      // Emit error before throwing
      void onProgress?.({
        type: "error",
        message: `Clone failed: ${(error as Error).message}`,
        timestamp: new Date(),
        stage: "git-clone",
      });
      throw parseGitError(error as Error);
    } finally {
      if (sshKeyPath) {
        await this.removeSshKeyFile(sshKeyPath);
      }
    }
  }

  async pull(options: GitPullOptions): Promise<void> {
    const { repoPath, branch, auth, onProgress } = options;

    void onProgress?.({
      type: "stage",
      message: "Starting pull operation...",
      timestamp: new Date(),
      stage: "git-pull",
    });

    let effectiveUrl: string | undefined;
    if (auth) {
      const git: SimpleGit = simpleGit(repoPath);
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin");
      if (origin?.refs?.fetch) {
        effectiveUrl = injectAuth(origin.refs.fetch, auth);

        await git.remote(["set-url", "origin", effectiveUrl]);
      }
    }

    let sshKeyPath: string | undefined;
    if (auth?.type === "ssh" && auth.credentials?.privateKey) {
      sshKeyPath = await this.createSshKeyEnv(auth.credentials.privateKey);
    }

    try {
      const git: SimpleGit = simpleGit(repoPath);
      const sshEnv = this.getSshCommandEnv(sshKeyPath);

      const originalEnv = { ...process.env };
      if (sshEnv.GIT_SSH_COMMAND) {
        process.env.GIT_SSH_COMMAND = sshEnv.GIT_SSH_COMMAND;
      }

      try {
        // Emit fetch progress
        void onProgress?.({
          type: "log",
          message: "Fetching from remote...",
          timestamp: new Date(),
          stage: "git-fetch",
        });

        if (branch) {
          await git.checkout(["-b", branch, `origin/${branch}`]);
          void onProgress?.({
            type: "log",
            message: `Created branch: ${branch}`,
            timestamp: new Date(),
            stage: "git-checkout",
          });
        }

        await git.pull();

        void onProgress?.({
          type: "complete",
          message: "Pull completed successfully",
          timestamp: new Date(),
          stage: "git-pull",
          progress: 100,
        });
      } finally {
        if (sshEnv.GIT_SSH_COMMAND) {
          if (originalEnv.GIT_SSH_COMMAND) {
            process.env.GIT_SSH_COMMAND = originalEnv.GIT_SSH_COMMAND;
          } else {
            delete process.env.GIT_SSH_COMMAND;
          }
        }
      }
    } catch (error) {
      void onProgress?.({
        type: "error",
        message: `Pull failed: ${(error as Error).message}`,
        timestamp: new Date(),
        stage: "git-pull",
      });
      throw parseGitError(error as Error);
    } finally {
      if (sshKeyPath) {
        await this.removeSshKeyFile(sshKeyPath);
      }
    }
  }

  async getLatestCommit(repoPath: string): Promise<CommitInfo> {
    try {
      const git: SimpleGit = simpleGit(repoPath);
      const log = await git.log({ maxCount: 1 });

      if (!log.latest) {
        throw new GitNotFoundError("No commits found in repository");
      }

      const { hash, message, author_name, date } = log.latest;

      return {
        hash,
        message,
        author: author_name || "Unknown",
        date: date ? new Date(date) : new Date(),
      };
    } catch (error) {
      if (error instanceof GitNotFoundError) {
        throw error;
      }
      throw new GitCloneError("Failed to get latest commit", {
        originalError: (error as Error).message,
      });
    }
  }

  async getBranches(repoPath: string): Promise<string[]> {
    try {
      const git: SimpleGit = simpleGit(repoPath);
      const branches = await git.branch(["-r"]);

      const branchNames = Object.keys(branches.branches)
        .filter((name) => name !== "HEAD" && !name.includes("HEAD"))
        .map((name) => {
          return name.replace(/^origin\//, "").trim();
        })
        .filter((name) => name.length > 0);

      return [...new Set(branchNames)];
    } catch (error) {
      throw new GitCloneError("Failed to get branches", {
        originalError: (error as Error).message,
      });
    }
  }

  async checkout(
    repoPath: string,
    branch: string,
    onProgress?: GitProgressCallback
  ): Promise<void> {
    try {
      const git: SimpleGit = simpleGit(repoPath);

      const branches = await git.branchLocal();
      const localBranchExists = branches.all.includes(branch);

      void onProgress?.({
        type: "stage",
        message: localBranchExists
          ? `Switching to branch: ${branch}`
          : `Creating branch: ${branch}`,
        timestamp: new Date(),
        stage: "git-checkout",
      });

      if (localBranchExists) {
        await git.checkout(branch);
      } else {
        await git.checkout(["-b", branch, `origin/${branch}`]);
      }

      void onProgress?.({
        type: "complete",
        message: `Now on branch: ${branch}`,
        timestamp: new Date(),
        stage: "git-checkout",
        progress: 100,
      });
    } catch (error) {
      void onProgress?.({
        type: "error",
        message: `Checkout failed: ${(error as Error).message}`,
        timestamp: new Date(),
        stage: "git-checkout",
      });
      throw new GitCloneError(`Failed to checkout branch: ${branch}`, {
        originalError: (error as Error).message,
      });
    }
  }

  async checkoutCommit(
    repoPath: string,
    sha: string,
    onProgress?: GitProgressCallback
  ): Promise<void> {
    try {
      void onProgress?.({
        type: "stage",
        message: `Checking out commit ${sha.substring(0, 7)}...`,
        timestamp: new Date(),
        stage: "git-checkout",
      });

      const git: SimpleGit = simpleGit(repoPath);
      await git.checkout(sha);

      void onProgress?.({
        type: "complete",
        message: "Commit checked out successfully",
        timestamp: new Date(),
        stage: "git-checkout",
        progress: 100,
      });
    } catch (error) {
      void onProgress?.({
        type: "error",
        message: `Checkout failed: ${(error as Error).message}`,
        timestamp: new Date(),
        stage: "git-checkout",
      });
      throw new GitCloneError(`Failed to checkout commit: ${sha}`, {
        originalError: (error as Error).message,
      });
    }
  }

  async getRemoteUrl(repoPath: string): Promise<string> {
    try {
      const git: SimpleGit = simpleGit(repoPath);
      const remotes = await git.getRemotes(true);
      const origin = remotes.find((r) => r.name === "origin");

      if (!origin?.refs?.fetch) {
        throw new GitNotFoundError("No origin remote found");
      }

      return origin.refs.fetch;
    } catch (error) {
      if (error instanceof GitNotFoundError) {
        throw error;
      }
      throw new GitCloneError("Failed to get remote URL", {
        originalError: (error as Error).message,
      });
    }
  }

  async getCurrentBranch(repoPath: string): Promise<string> {
    try {
      const git: SimpleGit = simpleGit(repoPath);
      const branches = await git.branchLocal();
      return branches.current || "HEAD";
    } catch (error) {
      throw new GitCloneError("Failed to get current branch", {
        originalError: (error as Error).message,
      });
    }
  }
}
