/**
 * Git service type definitions
 */

/**
 * Progress event interface compatible with @forge/build's BuildProgressEvent
 * Provides real-time visibility into git operations
 */
export interface GitProgressEvent {
  type: "log" | "stage" | "complete" | "error";
  message: string;
  timestamp: Date;
  stage?: string;
  progress?: number;
}

export type GitProgressCallback = (event: GitProgressEvent) => void | Promise<void>;

export interface GitCloneOptions {
  url: string;
  branch?: string;
  depth?: number;
  destinationPath: string;
  auth?: GitAuth;
  onProgress?: GitProgressCallback;
}

export interface GitAuth {
  type: "ssh" | "token" | "basic";
  credentials?: {
    username?: string;
    password?: string;
    token?: string;
    privateKey?: string;
  };
}

export interface GitPullOptions {
  repoPath: string;
  branch?: string;
  auth?: GitAuth;
  onProgress?: GitProgressCallback;
}

export interface CommitInfo {
  hash: string;
  message: string;
  author: string;
  date: Date;
}

export interface GitCheckoutOptions {
  repoPath: string;
  ref: string;
}

export interface IGitService {
  clone(options: GitCloneOptions): Promise<string>;
  pull(options: GitPullOptions): Promise<void>;
  checkout(repoPath: string, branch: string, onProgress?: GitProgressCallback): Promise<void>;
  checkoutCommit(repoPath: string, sha: string, onProgress?: GitProgressCallback): Promise<void>;
  getLatestCommit(repoPath: string): Promise<CommitInfo>;
  getBranches(repoPath: string): Promise<string[]>;
  getRemoteUrl(repoPath: string): Promise<string>;
  getCurrentBranch(repoPath: string): Promise<string>;
}
