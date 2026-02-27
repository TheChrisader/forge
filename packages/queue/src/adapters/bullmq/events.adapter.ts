/**
 * BullMQ event emitter adapter implementation
 */

import { QueueEvents } from "bullmq";
import type Redis from "ioredis";
import type { IEventEmitter } from "../../domain/interfaces";

/**
 * BullMQ Event Emitter Adapter
 */
export class BullMQEventEmitterAdapter implements IEventEmitter {
  private events: QueueEvents;

  constructor(name: string, connection: Redis) {
    this.events = new QueueEvents(name, { connection });
  }

  onProgress(handler: (...args: unknown[]) => void): void {
    this.events.on("progress", handler);
  }

  onCompleted(handler: (...args: unknown[]) => void): void {
    this.events.on("completed", handler);
  }

  onFailed(handler: (...args: unknown[]) => void): void {
    this.events.on("failed", handler);
  }

  removeAllListeners(): void {
    this.events.removeAllListeners();
  }

  async close(): Promise<void> {
    await this.events.close();
  }

  /**
   * Get the raw BullMQ QueueEvents (for advanced use cases)
   * @internal
   */
  getRawEvents(): QueueEvents {
    return this.events;
  }
}
