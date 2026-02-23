/**
 * Git service type definitions
 */

export interface GitCloneOptions {
  url: string;
  branch?: string;
  depth?: number;
  destinationPath: string;
  auth?: GitAuth;
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
