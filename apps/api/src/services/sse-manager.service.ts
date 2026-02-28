/**
 * SSE Manager Service
 *
 * A generic SSE connection and event routing manager for Server-Sent Events.
 * Handles topic-based routing of events to connected clients.
 *
 * This service is not coupled to any specific domain - deployment logs
 * are just one use case. It can be used for notifications, status updates,
 * or any real-time streaming needs.
 */

import type { FastifyReply } from "fastify";
import type { SSEMessage } from "@fastify/sse";

/**
 * SSE Manager Service
 *
 * Manages SSE connections and broadcasts events to subscribers by topic.
 * Topics are strings that identify a channel (e.g., "deployment:123").
 */
export class SSEManagerService {
  private connections: Map<string, Set<FastifyReply>> = new Map();

  /**
   * Subscribe a connection to a topic
   *
   * @param topic - The topic to subscribe to (e.g., "deployment:123")
   * @param reply - The Fastify reply object with SSE capabilities
   */
  subscribe(topic: string, reply: FastifyReply): void {
    if (!this.connections.has(topic)) {
      this.connections.set(topic, new Set());
    }
    this.connections.get(topic)!.add(reply);
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
   * @param topic - The topic to publish to
   * @param message - The SSE message to send
   */
  publish(topic: string, message: SSEMessage): void {
    const subscribers = this.connections.get(topic);
    if (!subscribers) return;

    // Create a snapshot of subscribers to avoid modification during iteration
    const subscribersArray = Array.from(subscribers);

    for (const reply of subscribersArray) {
      // Check if connection is still alive before sending
      if (reply.sse?.isConnected) {
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
    for (const subscribers of this.connections.values()) {
      total += subscribers.size;
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
   * Remove all connections (for testing/shutdown)
   */
  clear(): void {
    this.connections.clear();
  }
}
