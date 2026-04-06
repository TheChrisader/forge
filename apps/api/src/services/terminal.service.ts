import { randomUUID } from "node:crypto";
import type { PrismaClient } from "@forge/database";
import type { DockerRuntime, InteractiveExecSession } from "@forge/docker";
import type { ILogger } from "@forge/core";

interface ActiveTerminalSession {
  id: string;
  execSession: InteractiveExecSession;
  containerId: string;
  userId: string;
  createdAt: number;
  lastActivityAt: number;
}

export interface TerminalServiceConfig {
  maxSessionsPerUser: number;
  idleTimeoutMs: number;
  cleanupIntervalMs: number;
  defaultShell: string;
  defaultRows: number;
  defaultCols: number;
}

const DEFAULT_CONFIG: TerminalServiceConfig = {
  maxSessionsPerUser: 5,
  idleTimeoutMs: 15 * 60 * 1000,
  cleanupIntervalMs: 30 * 1000,
  defaultShell: "/bin/bash",
  defaultRows: 24,
  defaultCols: 80,
};

export class TerminalService {
  private sessions = new Map<string, ActiveTerminalSession>();
  private userSessionCounts = new Map<string, number>();
  private cleanupTimer?: NodeJS.Timeout;
  private readonly config: TerminalServiceConfig;

  constructor(
    private readonly db: PrismaClient,
    private readonly runtime: DockerRuntime,
    private readonly logger: ILogger,
    config?: Partial<TerminalServiceConfig>
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleSessions();
    }, this.config.cleanupIntervalMs);

    this.cleanupTimer.unref();
  }

  /**
   * Create a new terminal session for a container.
   *
   * @param containerId - Forge container ID (Docker container ID)
   * @param userId - Authenticated user ID
   * @param options - Terminal options (shell, rows, cols)
   * @returns Session ID for the new terminal session
   * @throws Error if container is not running or session limit reached
   */
  async createSession(
    containerId: string,
    userId: string,
    options?: { shell?: string; rows?: number; cols?: number }
  ): Promise<{ sessionId: string }> {
    const dbContainer = await this.db.container.findUnique({
      where: { id: containerId },
    });

    if (!dbContainer) {
      throw new Error(`Container ${containerId} not found`);
    }

    const dockerContainerId = dbContainer.containerId;

    try {
      const containerInfo = await this.runtime.inspect(dockerContainerId);
      if (containerInfo.state.status !== "running") {
        throw new Error(
          `Container ${containerId} is not running (status: ${containerInfo.state.status})`
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("is not running")) {
        throw err;
      }
      throw new Error(`Container ${containerId} not found or inaccessible`);
    }

    const currentCount = this.userSessionCounts.get(userId) ?? 0;
    if (currentCount >= this.config.maxSessionsPerUser) {
      throw new Error(
        `Maximum terminal sessions reached (${this.config.maxSessionsPerUser}). Close an existing session and try again.`
      );
    }

    const shell = options?.shell ?? this.config.defaultShell;
    const rows = options?.rows ?? this.config.defaultRows;
    const cols = options?.cols ?? this.config.defaultCols;

    const execSession = await this.runtime.interactiveExec(dockerContainerId, {
      shell,
      rows,
      cols,
    });

    const sessionId = randomUUID();
    const now = Date.now();

    const session: ActiveTerminalSession = {
      id: sessionId,
      execSession,
      containerId,
      userId,
      createdAt: now,
      lastActivityAt: now,
    };

    this.sessions.set(sessionId, session);
    this.userSessionCounts.set(userId, currentCount + 1);

    this.logger.debug("Terminal session created", {
      sessionId,
      containerId,
      userId,
      shell,
    });

    execSession.onExit.then(
      ({ exitCode }) => {
        this.logger.debug("Terminal exec process exited", {
          sessionId,
          exitCode,
        });
        this.removeSession(sessionId);
      },
      (err) => {
        this.logger.warn("Terminal exec process errored", {
          sessionId,
          error: err instanceof Error ? err.message : String(err),
        });
        this.removeSession(sessionId);
      }
    );

    return { sessionId };
  }

  /**
   * Write raw bytes into a terminal session (user keystrokes).
   */
  // Disabling eslint warning to keep the option open for future improvements
  // without having to change the interface
  // eslint-disable-next-line @typescript-eslint/require-await
  async write(sessionId: string, userId: string, data: Buffer): Promise<void> {
    const session = this.getOwnedSession(sessionId, userId);
    session.execSession.write(data);
    session.lastActivityAt = Date.now();
  }

  /**
   * Resize the TTY dimensions of a terminal session.
   */
  async resize(sessionId: string, userId: string, rows: number, cols: number): Promise<void> {
    const session = this.getOwnedSession(sessionId, userId);
    await session.execSession.resize(rows, cols);
    session.lastActivityAt = Date.now();
  }

  /**
   * Close a terminal session and kill the exec process.
   */
  // Disabling eslint warning to keep the option open for future improvements
  // without having to change the interface
  // eslint-disable-next-line @typescript-eslint/require-await
  async closeSession(sessionId: string, userId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    if (session.userId !== userId) {
      throw new Error("Session does not belong to this user");
    }

    this.removeSession(sessionId);
  }

  /**
   * Get the output stream for piping to a WebSocket.
   */
  getOutputStream(sessionId: string): NodeJS.ReadableStream | undefined {
    const session = this.sessions.get(sessionId);
    return session?.execSession.output;
  }

  /**
   * Get session info (for auth checks).
   */
  getSession(sessionId: string): ActiveTerminalSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Clean up all active sessions on server shutdown.
   */
  async dispose(): Promise<void> {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }

    const sessionIds = [...this.sessions.keys()];
    await Promise.allSettled(
      sessionIds.map(async (id) => {
        const session = this.sessions.get(id);
        if (session) {
          try {
            await session.execSession.kill();
          } catch {
            // Best-effort cleanup. The exec could possibly already be dead.
          }
        }
      })
    );

    this.sessions.clear();
    this.userSessionCounts.clear();

    this.logger.info(`Disposed ${sessionIds.length} terminal sessions`);
  }

  /**
   * Get the number of active sessions for a user.
   */
  getUserSessionCount(userId: string): number {
    return this.userSessionCounts.get(userId) ?? 0;
  }

  /**
   * Remove a session from tracking and decrement user session count.
   */
  private removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return;
    }

    this.sessions.delete(sessionId);

    const currentCount = this.userSessionCounts.get(session.userId) ?? 0;
    this.userSessionCounts.set(session.userId, Math.max(0, currentCount - 1));

    // The exec may already be dead
    session.execSession.kill().catch(() => {});
  }

  /**
   * Get a session and verify ownership.
   */
  private getOwnedSession(sessionId: string, userId: string): ActiveTerminalSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Terminal session not found");
    }
    if (session.userId !== userId) {
      throw new Error("Session does not belong to this user");
    }
    return session;
  }

  /**
   * Periodically clean up idle sessions.
   */
  private cleanupIdleSessions(): void {
    const now = Date.now();
    const expired: string[] = [];

    for (const [id, session] of this.sessions) {
      if (now - session.lastActivityAt > this.config.idleTimeoutMs) {
        expired.push(id);
      }
    }

    for (const id of expired) {
      this.logger.info("Terminal session timed out", { sessionId: id });
      this.removeSession(id);
    }

    if (expired.length > 0) {
      this.logger.debug(`Cleaned up ${expired.length} idle terminal sessions`);
    }
  }
}
