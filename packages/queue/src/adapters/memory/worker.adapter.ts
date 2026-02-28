/**
 * In-memory worker adapter implementation
 */

import type { JobInfo } from "@forge/types";
import type { IWorkerAdapter, IJobContext } from "../../domain/interfaces";
import type { QueueConfig, WorkerOptions } from "../../domain/types";

/**
 * In-memory Job Context implementation
 */
class InMemoryJobContext<T> implements IJobContext<T> {
  constructor(
    private readonly worker: InMemoryWorkerAdapter,
    public readonly job: JobInfo<T>
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async updateProgress(progress: number | Record<string, unknown>): Promise<void> {
    for (const handler of this.worker.progressHandlers) {
      callHandlerSafely(
        () => handler(this.job, progress),
        "[InMemoryWorker] onProgress handler error:"
      );
    }
  }
}

/**
 * Call a handler that may return void or Promise<void>, catching any errors
 */
function callHandlerSafely(handler: () => void | Promise<void>, errorMessage: string): void {
  const result = handler();
  if (result && typeof result.then === "function") {
    // It's a Promise
    void result.catch((error: Error) => {
      console.error(errorMessage, error);
    });
  }
}

/**
 * In-memory Worker Adapter
 */
export class InMemoryWorkerAdapter implements IWorkerAdapter {
  private running = true;
  private paused = false;
  private completedHandlers: Array<(job: JobInfo, result: unknown) => void | Promise<void>> = [];
  private failedHandlers: Array<(job: JobInfo | undefined, error: Error) => void | Promise<void>> =
    [];

  /** Expose progress handlers for context to use (must be public readonly) */
  public readonly progressHandlers: Array<
    (job: JobInfo, progress: number | object) => void | Promise<void>
  > = [];

  constructor(
    _name: string,
    rawProcessor: (context: IJobContext<unknown>) => Promise<unknown>,
    _config: QueueConfig,
    options?: WorkerOptions
  ) {
    void options?.concurrency;

    this.processor = async (job: JobInfo): Promise<unknown> => {
      const context = new InMemoryJobContext<unknown>(this, job);
      return rawProcessor(context);
    };
  }

  private readonly processor: (job: JobInfo) => Promise<unknown>;

  // eslint-disable-next-line @typescript-eslint/require-await
  async pause(): Promise<void> {
    this.paused = true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async resume(): Promise<void> {
    this.paused = false;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async close(): Promise<void> {
    this.running = false;
    this.completedHandlers = [];
    this.failedHandlers = [];
  }

  isRunning(): boolean {
    return this.running;
  }

  isPaused(): boolean {
    return this.paused;
  }

  onCompleted<T, R>(handler: (job: JobInfo<T>, result: R) => void | Promise<void>): void {
    this.completedHandlers.push(handler as (job: JobInfo, result: unknown) => void | Promise<void>);
  }

  onFailed<T>(handler: (job: JobInfo<T> | undefined, error: Error) => void | Promise<void>): void {
    this.failedHandlers.push(
      handler as (job: JobInfo | undefined, error: Error) => void | Promise<void>
    );
  }

  onProgress<T>(
    handler: (job: JobInfo<T>, progress: number | object) => void | Promise<void>
  ): void {
    this.progressHandlers.push(
      handler as (job: JobInfo, progress: number | object) => void | Promise<void>
    );
  }

  /**
   * Process a job manually (for testing purposes)
   * @internal
   */
  async processJob(job: JobInfo): Promise<void> {
    try {
      const result = await this.processor(job);
      for (const handler of this.completedHandlers) {
        callHandlerSafely(
          () => handler(job, result),
          "[InMemoryWorker] onCompleted handler error:"
        );
      }
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      for (const handler of this.failedHandlers) {
        callHandlerSafely(() => handler(job, err), "[InMemoryWorker] onFailed handler error:");
      }
    }
  }

  /**
   * Emit a progress event (for testing purposes)
   * @internal
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async emitProgress(job: JobInfo, progress: number | object): Promise<void> {
    for (const handler of this.progressHandlers) {
      callHandlerSafely(() => handler(job, progress), "[InMemoryWorker] onProgress handler error:");
    }
  }
}
