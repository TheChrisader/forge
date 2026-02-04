import { DockerRuntime } from "./runtime/docker";
import { DockerConnectionOptions } from "./interfaces/runtime";
import { DockerRuntimeError } from "./errors";

function getTestConfig(): DockerConnectionOptions {
  // override config
  if (process.env.DOCKER_HOST) {
    return {
      mode: "http",
      host: process.env.DOCKER_HOST,
      port: parseInt(process.env.DOCKER_PORT || "2375", 10),
    };
  }

  // use default (platform-aware) connection
  return {};
}

const TEST_LABELS = {
  "forge.test": "true",
  "forge.test.run": Date.now().toString(),
};

let createdContainerIds: string[] = [];
let createdNetworkIds: string[] = [];

async function cleanup(runtime: DockerRuntime): Promise<void> {
  console.log("\n Cleaning up test artifacts...");

  for (const containerId of createdContainerIds) {
    try {
      await runtime.remove(containerId, { force: true, volumes: true });
      console.log(`  ✓ Removed container: ${containerId.slice(0, 12)}`);
    } catch (error) {
      console.error(`  ✗ Failed to remove container ${containerId.slice(0, 12)}:`, error);
    }
  }

  for (const networkId of createdNetworkIds) {
    try {
      await runtime.removeNetwork(networkId);
      console.log(`  ✓ Removed network: ${networkId.slice(0, 12)}`);
    } catch (error) {
      console.error(`  ✗ Failed to remove network ${networkId.slice(0, 12)}:`, error);
    }
  }
}

async function testDockerRuntime(): Promise<void> {
  console.log("Testing Docker Runtime (Cross-Platform)\n");
  console.log(`Platform: ${process.platform}`);
  console.log(`Node: ${process.version}\n`);

  const runtime = new DockerRuntime(getTestConfig());

  try {
    console.log("0. Checking Docker daemon health...");
    const health = await runtime.healthCheck();
    if (!health.healthy) {
      throw new Error(`Docker daemon unhealthy: ${health.error}`);
    }
    console.log(`✓ Docker daemon v${health.version} (${health.os})`);

    console.log("\n1. Listing existing containers...");
    const containers = await runtime.list();
    console.log(`✓ Found ${containers.length} running/stopped containers`);
    if (containers.length > 0) {
      console.log("  Recent containers:");
      containers.slice(0, 3).forEach((c) => {
        console.log(`    - ${c.name || c.id.slice(0, 12)} (${c.status})`);
      });
    }

    console.log("\n2. Creating test network...");
    const network = await runtime.createNetwork({
      name: `forge-test-network-${Date.now()}`,
      driver: "bridge",
    });
    createdNetworkIds.push(network.id);
    console.log(`✓ Created network: ${network.name} (${network.id.slice(0, 12)})`);

    console.log("\n3. Pulling test image (nginx:alpine)...");
    await runtime.pullImage("nginx", {
      tag: "alpine",
      onProgress: (progress) => {
        if (progress.status === "Downloading" && progress.progressDetail) {
          const percent = (
            (progress.progressDetail.current / progress.progressDetail.total) *
            100
          ).toFixed(1);
          process.stdout.write(`\r  Progress: ${percent}%`);
        }
      },
    });
    console.log("\n✓ Image pulled successfully");

    console.log("\n4. Creating test container...");
    const containerName = `forge-test-container-${Date.now()}`;
    const container = await runtime.create({
      name: containerName,
      image: "nginx:alpine",
      network: network.name,
      labels: TEST_LABELS,
      ports: [{ containerPort: 80, hostPort: 0 }],
      env: {
        TEST_VAR: "test-value",
      },
      healthCheck: {
        test: ["CMD-SHELL", "wget -q --spider http://localhost/ || exit 1"],
        interval: "5s",
        timeout: "3s",
        retries: 3,
        startPeriod: "5s",
      },
    });
    createdContainerIds.push(container.id);
    console.log(`✓ Created container: ${container.name} (${container.id.slice(0, 12)})`);

    console.log("\n5. Starting container...");
    await runtime.start(container.id);
    console.log("✓ Container started");

    console.log("\n6. Waiting for container to be healthy...");
    await runtime.waitForHealthy(container.id, { timeout: 30000 });
    console.log("✓ Container is healthy");

    console.log("\n7. Inspecting container...");
    const info = await runtime.inspect(container.id);
    console.log(`✓ Container info:`);
    console.log(`  - Status: ${info.status}`);
    console.log(`  - Running: ${info.state.running}`);
    console.log(
      `  - IP: ${
        info.networkSettings.ipAddress ||
        Object.values(info.networkSettings.networks)[0]?.ipAddress ||
        "N/A"
      }`
    );
    console.log(`  - Health: ${info.health?.status || "none"}`);

    console.log("\n8. Getting container stats...");
    const stats = await runtime.stats(container.id);
    console.log(`✓ Container stats:`);
    console.log(`  - CPU: ${stats.cpu.usage.toFixed(2)}%`);
    console.log(
      `  - Memory: ${(stats.memory.usage / 1024 / 1024).toFixed(2)} MB / ` +
        `${(stats.memory.limit / 1024 / 1024).toFixed(2)} MB (` +
        `${stats.memory.percentage.toFixed(2)}%)`
    );

    console.log("\n9. Executing command in container...");
    const execResult = await runtime.exec(container.id, ["nginx", "-v"]);
    console.log(`✓ Command executed:`);
    console.log(`  - Exit code: ${execResult.exitCode}`);
    console.log(`  - Output: ${execResult.output.trim() || execResult.error?.trim()}`);

    console.log("\n10. Getting container logs...");
    const logs: string[] = [];
    for await (const log of runtime.logs(container.id, { tail: 10 })) {
      logs.push(log.message);
    }
    console.log(`✓ Retrieved ${logs.length} log entries`);
    if (logs.length > 0) {
      console.log(`  Latest: ${logs[logs.length - 1].slice(0, 80)}`);
    }

    console.log("\n11. Testing waitForState...");
    await runtime.waitForState(container.id, "running", { timeout: 5000 });
    console.log("✓ Container is in running state");

    console.log("\n12. Stopping container...");
    await runtime.stop(container.id, { timeout: 10 });
    console.log("✓ Container stopped");

    console.log("\n13. Testing waitForState (exited)...");
    await runtime.waitForState(container.id, "exited", { timeout: 10000 });
    console.log("✓ Container is in exited state");

    console.log("\n14. Removing container...");
    await runtime.remove(container.id);
    createdContainerIds = createdContainerIds.filter((id) => id !== container.id);
    console.log("✓ Container removed");

    console.log("\n15. Listing networks...");
    const networks = await runtime.listNetworks();
    const forgeNetworks = networks.filter((n) => n.name.includes("forge-test"));
    console.log(`✓ Found ${forgeNetworks.length} test networks`);

    console.log("\n16. Removing test network...");
    await runtime.removeNetwork(network.id);
    createdNetworkIds = createdNetworkIds.filter((id) => id !== network.id);
    console.log("✓ Network removed");

    console.log("\n17. Final health check...");
    const finalHealth = await runtime.healthCheck();
    console.log(`✓ Docker daemon still healthy: ${finalHealth.healthy}`);

    console.log("\n All Docker runtime tests passed!");
    console.log("\n Summary:");
    console.log("  ✓ Cross-platform connection");
    console.log("  ✓ Health checks");
    console.log("  ✓ Container lifecycle");
    console.log("  ✓ Wait patterns");
    console.log("  ✓ Network operations");
    console.log("  ✓ Image operations");
    console.log("  ✓ Log streaming");
    console.log("  ✓ Command execution");
    console.log("  ✓ Stats collection");
    console.log("  ✓ Proper cleanup");

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Test failed:", error);

    if (error instanceof DockerRuntimeError) {
      console.error(`  Code: ${error.code}`);
      console.error(`  Status: ${error.statusCode}`);
      console.error(`  Details:`, error.details);
    }

    await cleanup(runtime);

    process.exit(1);
  }
}

process.on("SIGINT", async () => {
  console.log("\n\n⚠️  Test interrupted by user");
  const runtime = new DockerRuntime(getTestConfig());
  await cleanup(runtime);
  process.exit(130);
});

process.on("SIGTERM", async () => {
  console.log("\n\n⚠️  Test terminated");
  const runtime = new DockerRuntime(getTestConfig());
  await cleanup(runtime);
  process.exit(143);
});

testDockerRuntime();
