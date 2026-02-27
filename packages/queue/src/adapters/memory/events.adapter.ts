/**
 * In-memory event emitter implementation
 * For testing purposes - events are stored in memory
 */

import type { IEventEmitter } from "../../domain/interfaces";

/**
 * In-memory Event Emitter Adapter
 */
export class InMemoryEventEmitterAdapter implements IEventEmitter {
  private progressHandlers: Array<(...args: unknown[]) => void> = [];
  private completedHandlers: Array<(...args: unknown[]) => void> = [];
  private failedHandlers: Array<(...args: unknown[]) => void> = [];

  onProgress(handler: (...args: unknown[]) => void): void {
    this.progressHandlers.push(handler);
  }

  onCompleted(handler: (...args: unknown[]) => void): void {
    this.completedHandlers.push(handler);
  }

  onFailed(handler: (...args: unknown[]) => void): void {
    this.failedHandlers.push(handler);
  }

  removeAllListeners(): void {
    this.progressHandlers = [];
    this.completedHandlers = [];
    this.failedHandlers = [];
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close(): Promise<void> {
    this.removeAllListeners();
  }

  /**
   * Emit a progress event (for testing purposes)
   * @internal
   */
  emitProgress(...args: unknown[]): void {
    for (const handler of this.progressHandlers) {
      try {
        handler(...args);
      } catch {
        // Ignore errors in handlers
      }
    }
  }

  /**
   * Emit a completed event (for testing purposes)
   * @internal
   */
  emitCompleted(...args: unknown[]): void {
    for (const handler of this.completedHandlers) {
      try {
        handler(...args);
      } catch {
        // Ignore errors in handlers
      }
    }
  }

  /**
   * Emit a failed event (for testing purposes)
   * @internal
   */
  emitFailed(...args: unknown[]): void {
    for (const handler of this.failedHandlers) {
      try {
        handler(...args);
      } catch {
        // Ignore errors in handlers
      }
    }
  }
}
