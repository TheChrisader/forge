import "dotenv/config";
import { QueueService } from "./service";
import { QUEUE_NAMES } from "./queues";
import type { BuildJobData, BuildJobResult } from "./types";

const config = {
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD,
  },
};

async function testQueueService(): Promise<void> {
  console.log("Testing Queue Service...\n");

  const queueService = new QueueService(config);

  try {
    console.log("1. Adding jobs to queue...");

    const jobIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const jobId = await queueService.addJob<BuildJobData>(
        QUEUE_NAMES.BUILD,
        `build-${i}`,
        {
          deploymentId: `deployment-${i}`,
          projectId: `project-${i}`,
          version: `v1.0.${i}`,
        },
        {
          priority: i % 2 === 0 ? 10 : 5,
          attempts: 3,
        }
      );

      jobIds.push(jobId);
      console.log(`  ✓ Added job ${i + 1}/5: ${jobId}`);
    }

    console.log("\n2. Checking queue health...");
    const health = await queueService.getHealth(QUEUE_NAMES.BUILD);
    console.log("  Queue health:", health);

    console.log("\n3. Registering worker...");

    let processedCount = 0;

    queueService.registerWorker<BuildJobData, BuildJobResult>(
      QUEUE_NAMES.BUILD,
      async (job) => {
        console.log(`  Processing job ${job.id}:`, job.data);

        await job.updateProgress(25);
        await new Promise((resolve) => setTimeout(resolve, 100));

        await job.updateProgress(50);
        await new Promise((resolve) => setTimeout(resolve, 100));

        await job.updateProgress(75);
        await new Promise((resolve) => setTimeout(resolve, 100));

        await job.updateProgress(100);

        processedCount++;

        return {
          success: true,
          image: `${job.data.projectId}:${job.data.version}`,
          logs: "Build completed successfully",
          duration: 300,
        };
      },
      {
        concurrency: 2,
      }
    );

    console.log("  ✓ Worker registered");

    console.log("\n4. Waiting for jobs to complete...");

    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log(`  ✓ Processed ${processedCount} jobs`);

    console.log("\n5. Getting metrics...");
    const metrics = await queueService.getMetrics();
    console.log("  Metrics:", JSON.stringify(metrics, null, 2));

    console.log("\n6. Getting health of all queues...");
    const allHealth = await queueService.getAllHealth();
    for (const [queueName, health] of allHealth.entries()) {
      const healthData = health as { healthy: boolean };
      console.log(`  ${queueName}:`, healthData.healthy ? "✓ Healthy" : "✗ Unhealthy");
    }

    console.log("\n7. Cleaning old jobs...");
    await queueService.cleanQueues(0, 1000);
    console.log("  ✓ Cleanup complete");

    console.log("\n8. Testing error handling...");

    const errorWorker = queueService.registerWorker(
      QUEUE_NAMES.DEPLOY,
      async () => {
        throw new Error("Simulated error");
      },
      {
        concurrency: 1,
      }
    );

    await queueService.addJob(QUEUE_NAMES.DEPLOY, "error-test", { test: true }, { attempts: 2 });

    await new Promise((resolve) => setTimeout(resolve, 2000));

    const deployHealth = await queueService.getHealth(QUEUE_NAMES.DEPLOY);
    console.log("  Failed jobs:", deployHealth.counts.failed);

    await errorWorker.close();

    console.log("\n All queue service tests passed!");
  } catch (error) {
    console.error("\n Test failed:", error);
    throw error;
  } finally {
    await queueService.close();
  }
}

testQueueService()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
