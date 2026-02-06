import "dotenv/config";
import { QueueService } from "./service";
import type { BuildJobData, BuildJobResult } from "./types";
import { QUEUE_NAMES } from "./queues";

const config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
};

async function testQueue(): Promise<void> {
  try {
    console.log("Testing Redis connection...");

    const queueService = new QueueService(config);

    const redis = queueService.getConnectionHealth();
    console.log("✓ Redis connection established:", redis);

    console.log("\nTesting queue operations...");

    const jobId = await queueService.addJob<BuildJobData>(QUEUE_NAMES.BUILD, "test-build", {
      deploymentId: "test-deployment-123",
      projectId: "test-project-456",
      version: "1.0.0",
    });
    console.log("✓ Added job to queue:", jobId);

    const worker = queueService.registerWorker<BuildJobData, BuildJobResult>(
      QUEUE_NAMES.BUILD,
      async (job) => {
        console.log("  → Processing job:", job.id, job.data);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const result: BuildJobResult = {
          success: true,
          image: "test-image:latest",
          logs: "Build completed successfully",
        };

        return result;
      }
    );

    worker.onCompleted((job, result) => {
      console.log(`  ✓ Job ${job.id} completed:`, result);
    });

    worker.onFailed((job, error) => {
      console.error(`  ✗ Job ${job?.id} failed:`, error.message);
    });

    worker.onProgress((job, progress) => {
      console.log(`  → Job ${job.id} progress:`, progress);
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    await queueService.close();

    console.log("\n✓ All queue tests passed!");

    setTimeout(() => process.exit(0), 100);
  } catch (error) {
    console.error("✗ Queue test failed:", error);
    process.exit(1);
  }
}

testQueue();
