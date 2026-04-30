import type { BuildProgress, BuildOptions } from "@forge/docker";
import type { BuildProgressCallback } from "../interfaces/strategy.js";

/**
 * Adapter to convert callback-based progress from Docker runtime to strategy progress callback
 * Allows strategies to use callbacks while Docker runtime uses its own callback format
 *
 * Usage:
 * ```typescript
 * const adapter = new ProgressAdapter(onProgress);
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
 */
export class ProgressAdapter {
  private currentStage: string = "init";

  constructor(private readonly onProgress?: BuildProgressCallback) {}

  /**
   * Create a BuildOptions onProgress callback that converts Docker's BuildProgress
   * to strategy's BuildProgressEvent
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
    void this.onProgress?.({
      type: "log",
      message: message.trim(),
      timestamp: new Date(),
      stage: this.currentStage,
    });
  }

  private emitStage(stage: string): void {
    this.currentStage = stage;
    void this.onProgress?.({
      type: "stage",
      message: `Starting: ${stage}`,
      timestamp: new Date(),
      stage,
    });
  }

  private emitError(error: string): void {
    void this.onProgress?.({
      type: "error",
      message: error,
      timestamp: new Date(),
      stage: this.currentStage,
    });
  }

  /** Call this when build completes successfully with actual Docker image ID */
  emitComplete(imageId: string): void {
    void this.onProgress?.({
      type: "complete",
      message: `Build completed successfully. Image: ${imageId}`,
      timestamp: new Date(),
      stage: "complete",
      progress: 100,
    });
  }

  /** Call this on the start of a build stage */
  emitStart(stage: string): void {
    this.currentStage = stage;
    void this.onProgress?.({
      type: "stage",
      message: `Starting: ${stage}`,
      timestamp: new Date(),
      stage,
    });
  }
}
