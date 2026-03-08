/**
 * Message Batcher Service
 *
 * Batches SSE messages for high-volume scenarios to reduce
 * the number of individual sends when there are many subscribers.
 *
 * Messages are accumulated for a short time window (default 50ms)
 * or until the batch reaches a maximum size (default 100 messages),
 * whichever comes first.
 *
 * This service is separate from SSEManagerService to maintain
 * single responsibility and testability.
 */

import type { SSEMessage } from "@fastify/sse";

export interface BatchConfig {
  windowMs: number;
  maxSize: number;
}

type FlushCallback = (messages: SSEMessage[]) => void;

interface BatchState {
  messages: SSEMessage[];
  timer: NodeJS.Timeout;
}

export class MessageBatcherService {
  private batches = new Map<string, BatchState>();

  constructor(private readonly config: BatchConfig) {}

  /**
   * Add a message to the batch for a topic
   *
   * @param topic - The topic identifier (e.g., "deployment:123")
   * @param message - The SSE message to add
   * @param flushFn - Callback function to flush the batch
   */
  add(topic: string, message: SSEMessage, flushFn: FlushCallback): void {
    const existing = this.batches.get(topic);

    if (existing) {
      // Add to existing batch
      existing.messages.push(message);

      // Check if we've reached max size - flush immediately
      if (existing.messages.length >= this.config.maxSize) {
        this.flushTopic(topic, flushFn);
      }
    } else {
      // Create new batch with timer
      const messages = [message];
      const timer = setTimeout(() => {
        this.flushTopic(topic, flushFn);
      }, this.config.windowMs);

      // Unref timer to allow process to exit if only this is active
      timer.unref();

      this.batches.set(topic, { messages, timer });
    }
  }

  /**
   * Immediately flush the pending batch for a topic
   *
   * @param topic - The topic identifier
   */
  flush(topic: string): void {
    const state = this.batches.get(topic);
    if (!state) {
      return;
    }

    clearTimeout(state.timer);
    this.batches.delete(topic);
  }

  /**
   * Clear all batches and timers
   *
   * Useful for testing or graceful shutdown
   */
  clear(): void {
    const states = Array.from(this.batches.values());
    for (const state of states) {
      clearTimeout(state.timer);
    }
    this.batches.clear();
  }

  /**
   * Get the current batch size for a topic
   *
   * @param topic - The topic identifier
   * @returns The number of messages currently batched
   */
  getBatchSize(topic: string): number {
    return this.batches.get(topic)?.messages.length ?? 0;
  }

  /**
   * Internal method to flush a topic's batch
   *
   * @param topic - The topic identifier
   * @param flushFn - Callback function to flush the batch
   */
  private flushTopic(topic: string, flushFn: FlushCallback): void {
    const state = this.batches.get(topic);
    if (!state) {
      return;
    }

    clearTimeout(state.timer);
    this.batches.delete(topic);

    if (state.messages.length > 0) {
      flushFn(state.messages);
    }
  }
}
