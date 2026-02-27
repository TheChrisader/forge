/**
 * Redis connection management for BullMQ adapters
 */

import Redis from "ioredis";
import type { QueueConnectionConfig } from "../../domain/types";

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
}

class RedisConnectionManager {
  private connections = new Map<string, Redis>();

  /**
   * Get or create a Redis connection
   */
  getConnection(config: RedisConfig, usage: "queue" | "worker" | "events" = "queue"): Redis {
    const key = this.getConfigKey(config, usage);

    if (!this.connections.has(key)) {
      const connection = new Redis({
        host: config.host,
        port: config.port,
        password: config.password,
        db: config.db || 0,
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
        // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
        retryStrategy: (times: number) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
      });

      connection.on("error", (error) => {
        // eslint-disable-next-line no-console
        console.error(`Redis connection error [${key}]:`, error);
      });

      connection.on("ready", () => {
        if (connection.status === "ready") {
          // eslint-disable-next-line no-console
          console.log(`Redis ready [${key}]`);
        }
      });

      this.connections.set(key, connection);
    }

    return this.connections.get(key)!;
  }

  /**
   * Close a specific connection
   */
  async closeConnection(
    config: RedisConfig,
    usage: "queue" | "worker" | "events" = "queue"
  ): Promise<void> {
    const key = this.getConfigKey(config, usage);
    const connection = this.connections.get(key);

    if (connection) {
      try {
        await connection.quit();
      } catch {
        // Ignore errors during close
      }
      this.connections.delete(key);
    }
  }

  /**
   * Close all connections for a specific configuration
   */
  async closeAllForConfig(config: RedisConfig): Promise<void> {
    const prefix = this.getConfigKey(config, "");
    const connectionsToClose: Array<{ key: string; conn: Redis }> = [];

    for (const [key, connection] of this.connections.entries()) {
      if (key.startsWith(prefix)) {
        connectionsToClose.push({ key, conn: connection });
      }
    }

    await Promise.all(
      connectionsToClose.map(async ({ conn }) => {
        try {
          await conn.quit();
        } catch {
          // Ignore errors during close
        }
      })
    );

    for (const { key } of connectionsToClose) {
      this.connections.delete(key);
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const connections = Array.from(this.connections.entries());

    await Promise.all(
      connections.map(async ([, conn]) => {
        try {
          await conn.quit();
        } catch {
          // Ignore errors during close
        }
      })
    );

    this.connections.clear();
  }

  /**
   * Get the number of active connections
   */
  getActiveConnections(): number {
    return this.connections.size;
  }

  /**
   * Generate a configuration key for the connection map
   */
  private getConfigKey(config: RedisConfig, usage: string): string {
    const configKey = `${config.host}:${config.port}:${config.db || 0}`;
    return usage ? `${configKey}:${usage}` : configKey;
  }
}

const connectionManager = new RedisConnectionManager();

export function getRedisConnection(
  config: RedisConfig,
  usage: "queue" | "worker" | "events" = "queue"
): Redis {
  return connectionManager.getConnection(config, usage);
}

export async function closeRedisConnection(
  config: RedisConfig,
  usage: "queue" | "worker" | "events" = "queue"
): Promise<void> {
  await connectionManager.closeConnection(config, usage);
}

export async function closeAllRedisConnectionsForConfig(config: RedisConfig): Promise<void> {
  await connectionManager.closeAllForConfig(config);
}

export async function closeAllRedisConnections(): Promise<void> {
  await connectionManager.closeAll();
}

export function getActiveConnectionCount(): number {
  return connectionManager.getActiveConnections();
}

export function extractRedisConfig(connection: QueueConnectionConfig): RedisConfig {
  if (connection.type !== "redis") {
    throw new Error(`Expected redis connection type, got: ${connection.type}`);
  }
  if (!connection.redis) {
    throw new Error("Redis connection config is missing");
  }
  return connection.redis;
}
