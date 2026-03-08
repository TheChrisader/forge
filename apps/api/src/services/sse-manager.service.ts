/**
 * SSE Manager Service
 *
 * A generic SSE connection and event routing manager for Server-Sent Events.
 * Handles topic-based routing of events to connected clients.
 *
 * This service is not coupled to any specific domain - deployment logs
 * are just one use case. It can be used for notifications, status updates,
 * or any real-time streaming needs.
 *
 * Features:
 * - Per-topic and global connection limits
 * - Idle connection timeout tracking and cleanup
 * - Message batching for high-volume scenarios
 * - Priority-based routing (critical events bypass batching)
 */

import type { FastifyReply } from "fastify";
import type { SSEMessage } from "@fastify/sse";
import type { SSEConfig } from "@forge/core";
import { ConnectionLimitError } from "../errors/connection-limit.error.js";
import type { MessageBatcherService } from "./message-batcher.service.js";

interface ConnectionMetadata {
  reply: FastifyReply;
  lastActivityAt: number;
}

interface RejectionMetrics {
  perTopic: number;
  global: number;
}

export class SSEManagerService {
  private connections: Map<string, Map<FastifyReply, ConnectionMetadata>> = new Map();
  private cleanupTimer?: NodeJS.Timeout;
  private rejectionMetrics: RejectionMetrics = {
    perTopic: 0,
    global: 0,
  };

  constructor(
    private readonly config: SSEConfig,
    private readonly batcher?: MessageBatcherService
  ) {
    if (!config.enabled) {
      return;
    }

    // Start periodic cleanup of idle connections (every 60 seconds)
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleConnections();
    }, 60000);

    // Unref timer to allow process to exit if only this is active
    this.cleanupTimer.unref();
  }

  /**
   * Subscribe a connection to a topic
   *
   * Enforces per-topic and global connection limits.
   * Throws ConnectionLimitError if limits are exceeded.
   *
   * @param topic - The topic to subscribe to (e.g., "deployment:123")
   * @param reply - The Fastify reply object with SSE capabilities
   * @throws ConnectionLimitError if connection limits are exceeded
   */
  subscribe(topic: string, reply: FastifyReply): void {
    if (!this.config.enabled) {
      throw new Error("SSE is disabled");
    }

    // Check per-topic limit
    const topicConnections = this.connections.get(topic);
    const topicCount = topicConnections?.size ?? 0;
    if (topicCount >= this.config.maxConnectionsPerTopic) {
      this.rejectionMetrics.perTopic++;
      throw new ConnectionLimitError("per-topic", this.config.maxConnectionsPerTopic, topicCount);
    }

    // Check global limit
    const globalCount = this.getTotalConnectionCount();
    if (globalCount >= this.config.maxTotalConnections) {
      this.rejectionMetrics.global++;
      throw new ConnectionLimitError("global", this.config.maxTotalConnections, globalCount);
    }

    // Initialize topic map if needed
    if (!this.connections.has(topic)) {
      this.connections.set(topic, new Map());
    }

    // Add connection with metadata
    const metadata: ConnectionMetadata = {
      reply,
      lastActivityAt: Date.now(),
    };
    this.connections.get(topic)!.set(reply, metadata);

    // Setup cleanup on close
    reply.raw.on("close", () => {
      this.unsubscribe(topic, reply);
    });
  }

  /**
   * Unsubscribe a connection from a topic
   *
   * @param topic - The topic to unsubscribe from
   * @param reply - The Fastify reply object to remove
   */
  unsubscribe(topic: string, reply: FastifyReply): void {
    const subscribers = this.connections.get(topic);
    if (subscribers) {
      subscribers.delete(reply);
      if (subscribers.size === 0) {
        this.connections.delete(topic);
      }
    }
  }

  /**
   * Publish a message to all subscribers of a topic
   *
   * Uses priority-based routing:
   * - Critical events (error, completed) are sent immediately
   * - High subscriber counts trigger message batching
   * - Otherwise, sends immediately to all subscribers
   *
   * @param topic - The topic to publish to
   * @param message - The SSE message to send
   */
  publish(topic: string, message: SSEMessage): void {
    const subscribers = this.connections.get(topic);
    if (!subscribers || subscribers.size === 0) {
      return;
    }

    // Critical events: bypass batching entirely
    if (this.isCriticalEvent(message)) {
      this.sendToAll(topic, subscribers, message);
      return;
    }

    // High subscriber count: use batching
    if (subscribers.size > this.config.batchThreshold && this.batcher) {
      this.batcher.add(topic, message, (batch) => {
        this.sendBatch(topic, subscribers, batch);
      });
      return;
    }

    // Default: immediate send
    this.sendToAll(topic, subscribers, message);
  }

  /**
   * Get the number of active connections for a topic
   *
   * @param topic - The topic to check
   * @returns The number of subscribers
   */
  getConnectionCount(topic: string): number {
    return this.connections.get(topic)?.size ?? 0;
  }

  /**
   * Get the total number of all active connections
   *
   * @returns The total number of subscribers across all topics
   */
  getTotalConnectionCount(): number {
    let total = 0;
    const subscribers = Array.from(this.connections.values());
    for (const sub of subscribers) {
      total += sub.size;
    }
    return total;
  }

  /**
   * Get all active topics
   *
   * @returns Array of active topic names
   */
  getActiveTopics(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Get rejection metrics
   *
   * @returns Object with perTopic and global rejection counts
   */
  getRejectionMetrics(): RejectionMetrics {
    return { ...this.rejectionMetrics };
  }

  /**
   * Reset rejection metrics
   */
  resetRejectionMetrics(): void {
    this.rejectionMetrics = {
      perTopic: 0,
      global: 0,
    };
  }

  /**
   * Remove all connections (for testing/shutdown)
   */
  clear(): void {
    this.connections.clear();
    this.batcher?.clear();
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
    this.clear();
  }

  /**
   * Check if an event is critical (should bypass batching)
   *
   * @param message - The SSE message to check
   * @returns true if the event is critical
   */
  private isCriticalEvent(message: SSEMessage): boolean {
    return message.event === "error" || message.event === "completed";
  }

  /**
   * Send a message to all subscribers of a topic
   *
   * @param topic - The topic identifier
   * @param subscribers - The subscribers map
   * @param message - The SSE message to send
   */
  private sendToAll(
    topic: string,
    subscribers: Map<FastifyReply, ConnectionMetadata>,
    message: SSEMessage
  ): void {
    // Create a snapshot of subscribers to avoid modification during iteration
    const subscribersArray = Array.from(subscribers.entries());

    for (const [reply, metadata] of subscribersArray) {
      // Check if connection is still alive before sending
      if (reply.sse?.isConnected) {
        // Update activity timestamp
        metadata.lastActivityAt = Date.now();

        void reply.sse.send(message).catch(() => {
          // Connection may be closed, unsubscribe
          this.unsubscribe(topic, reply);
        });
      } else {
        this.unsubscribe(topic, reply);
      }
    }
  }

  /**
   * Send a batch of messages to all subscribers
   *
   * @param topic - The topic identifier
   * @param subscribers - The subscribers map
   * @param batch - The batch of SSE messages to send
   */
  private sendBatch(
    topic: string,
    subscribers: Map<FastifyReply, ConnectionMetadata>,
    batch: SSEMessage[]
  ): void {
    // Create a snapshot of subscribers to avoid modification during iteration
    const subscribersArray = Array.from(subscribers.entries());

    for (const [reply, metadata] of subscribersArray) {
      // Check if connection is still alive before sending
      if (reply.sse?.isConnected) {
        // Update activity timestamp
        metadata.lastActivityAt = Date.now();

        // Send all messages in batch
        for (const message of batch) {
          void reply.sse.send(message).catch(() => {
            // Connection may be closed, unsubscribe
            this.unsubscribe(topic, reply);
          });
        }
      } else {
        this.unsubscribe(topic, reply);
      }
    }
  }

  /**
   * Periodically cleanup idle connections
   *
   * Iterates through all connections and closes those that have
   * been idle for longer than the configured timeout.
   */
  private cleanupIdleConnections(): void {
    const now = Date.now();
    const timeoutMs = this.config.connectionTimeoutMs;

    const entries = Array.from(this.connections.entries());
    for (const [topic, subscribers] of entries) {
      const idleReplies: FastifyReply[] = [];

      const subscriberEntries = Array.from(subscribers.entries());
      for (const [reply, metadata] of subscriberEntries) {
        if (now - metadata.lastActivityAt > timeoutMs) {
          idleReplies.push(reply);
        }
      }

      // Close idle connections
      for (const reply of idleReplies) {
        // Send timeout event before closing
        if (reply.sse?.isConnected) {
          void reply.sse
            .send({
              event: "timeout",
              data: { reason: "idle", message: "Connection closed due to inactivity" },
            })
            .catch(() => {
              // Connection may already be closed
            });
        }

        // Unsubscribe the connection
        this.unsubscribe(topic, reply);
      }
    }
  }
}
