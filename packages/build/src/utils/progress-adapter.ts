import type { EventEmitter } from "eventemitter3";
import type { BuildProgress, BuildOptions } from "@forge/docker";
import type { BuildProgressEvent } from "../interfaces/strategy.js";

/**
 * Adapter to convert EventEmitter-based progress to Docker onProgress callback
 * Allows strategies to use EventEmitter while Docker runtime uses callbacks
 *
 * Usage in Sprint 3:
 * ```typescript
 * const adapter = new ProgressAdapter(emitter);
 * adapter.emitStart("docker-build");
 *
 * const imageTag = await runtime.buildImage(context.sourceDir, {
 *   dockerfile: config?.dockerfile,
 *   tags: [`forge/${context.projectId}:${context.deploymentId}`],
 *   onProgress: adapter.createOnProgressCallback(),
 * });
 *
 * adapter.emitComplete(imageTag);
 * ```
 *
 * Sprint 2 note: emitComplete() requires an actual image ID from Docker runtime.
 * For Sprint 2 stub builds, emit a "complete" event directly without calling emitComplete().
 */
export class ProgressAdapter {
  private emitter: EventEmitter;
  private currentStage: string = "init";

  constructor(emitter: EventEmitter) {
    this.emitter = emitter;
  }

  /**
   * Create a BuildOptions onProgress callback that emits to EventEmitter
   * Converts Docker's BuildProgress to strategy's BuildProgressEvent
   */
  createOnProgressCallback(): NonNullable<BuildOptions["onProgress"]> {
    return (progress: BuildProgress) => {
      if (progress.error) {
        this.emitError(progress.error);
        return;
      }

      if (progress.stream) {
        this.emitLog(progress.stream);
      }

      if (progress.status) {
        this.emitStage(progress.status);
      }
    };
  }

  private emitLog(message: string): void {
    this.emitter.emit("progress", {
      type: "log",
      message: message.trim(),
      timestamp: new Date(),
      stage: this.currentStage,
    } as BuildProgressEvent);
  }

  private emitStage(stage: string): void {
    this.currentStage = stage;
    this.emitter.emit("progress", {
      type: "stage",
      message: `Starting: ${stage}`,
      timestamp: new Date(),
      stage,
    } as BuildProgressEvent);
  }

  private emitError(error: string): void {
    this.emitter.emit("progress", {
      type: "error",
      message: error,
      timestamp: new Date(),
      stage: this.currentStage,
    } as BuildProgressEvent);
  }

  /** Call this when build completes successfully with actual Docker image ID */
  emitComplete(imageId: string): void {
    this.emitter.emit("progress", {
      type: "complete",
      message: `Build completed successfully. Image: ${imageId}`,
      timestamp: new Date(),
      stage: "complete",
      progress: 100,
    } as BuildProgressEvent);
  }

  /** Call this to start a build stage */
  emitStart(stage: string): void {
    this.currentStage = stage;
    this.emitter.emit("progress", {
      type: "stage",
      message: `Starting: ${stage}`,
      timestamp: new Date(),
      stage,
    } as BuildProgressEvent);
  }
}
