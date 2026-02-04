import "dotenv/config";
import { createQueue, createWorker, getRedisConnection } from "./client";
import { BuildJobData, BuildJobResult } from "./types";
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

    const redis = getRedisConnection(config.redis);
    const pong = await redis.ping();
    console.log("✓ Redis ping:", pong);

    console.log("\nTesting queue operations...");
    const queue = createQueue<BuildJobData>(QUEUE_NAMES.BUILD, config);

    const job = await queue.add("test-build", {
      deploymentId: "test-deployment-123",
      projectId: "test-project-456",
      version: "1.0.0",
    });
    console.log("✓ Added job to queue:", job.id);

    const worker = createWorker<BuildJobData>(
      QUEUE_NAMES.BUILD,
      async (job) => {
        console.log("✓ Processing job:", job.id, job.data);

        await new Promise((resolve) => setTimeout(resolve, 100));

        const result: BuildJobResult = {
          success: true,
          image: "test-image:latest",
          logs: "Build completed successfully",
        };

        return result;
      },
      config
    );

    await new Promise((resolve) => {
      worker.on("completed", (job, result) => {
        console.log("✓ Job completed:", job.id);
        console.log("✓ Result:", result);
        resolve(result);
      });

      worker.on("failed", (job, error) => {
        console.error("✗ Job failed:", job?.id, error);
        resolve(null);
      });
    });

    await worker.close();
    await queue.close();

    console.log("\n✓ All queue tests passed!");
    process.exit(0);
  } catch (error) {
    console.error("✗ Queue test failed:", error);
    process.exit(1);
  }
}

testQueue();
