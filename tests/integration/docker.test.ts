import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { DockerRuntime } from "@forge/docker";
import { waitFor, collectAsync } from "@forge/test-utils";

/**
 * Docker Integration Tests
 *
 * These tests require Docker to be running on the host machine.
 * They test the actual Docker API through the DockerRuntime class.
 */
describe("Docker Integration", () => {
  let docker: DockerRuntime;
  const testContainers: string[] = [];
  const testNetworks: string[] = [];
  const testVolumes: string[] = [];

  beforeAll(async () => {
    docker = new DockerRuntime();

    const health = await docker.healthCheck();
    expect(health.healthy).toBe(true);
  }, 30000);

  afterAll(async () => {
    for (const containerId of testContainers) {
      try {
        await docker.stop(containerId, { timeout: 5 }).catch(() => {});
        await docker.remove(containerId, { force: true }).catch(() => {});
      } catch {
        // TODO: Log the exception
      }
    }

    for (const networkId of testNetworks) {
      try {
        await docker.removeNetwork(networkId).catch(() => {});
      } catch {
        // TODO: Log exception
      }
    }

    for (const volumeName of testVolumes) {
      try {
        await docker.removeVolume(volumeName).catch(() => {});
      } catch {
        // TODO: You know...
      }
    }
  }, 30000);

  describe("Container Lifecycle", () => {
    it("should create and start a container", async () => {
      const container = await docker.create({
        name: `forge-test-${Date.now()}`,
        image: "alpine:latest",
        cmd: ["sh", "-c", "sleep 30"],
        labels: {
          "forge.test": "true",
          "forge.test.id": "container-lifecycle",
        },
      });

      testContainers.push(container.id);

      expect(container).toBeDefined();
      expect(container.id).toBeDefined();
      expect(container.status).toBe("created");

      await docker.start(container.id);

      await waitFor(
        async () => {
          const info = await docker.inspect(container.id);
          return info.state.running;
        },
        { timeout: 10000, message: "Container did not start" }
      );

      const info = await docker.inspect(container.id);
      expect(info.state.running).toBe(true);
    }, 30000);

    it("should stop and remove a container", async () => {
      const container = await docker.create({
        image: "alpine:latest",
        cmd: ["sh", "-c", "sleep 60"],
        labels: { "forge.test": "true" },
      });

      testContainers.push(container.id);
      await docker.start(container.id);

      await waitFor(
        async () => {
          const info = await docker.inspect(container.id);
          return info.state.running;
        },
        { timeout: 10000, message: "Container did not start" }
      );

      await docker.stop(container.id, { timeout: 10 });

      const stoppedInfo = await docker.inspect(container.id);
      expect(stoppedInfo.state.running).toBe(false);

      await docker.remove(container.id);

      await expect(docker.inspect(container.id)).rejects.toThrow();
    }, 30000);

    it("should restart a container", async () => {
      const container = await docker.create({
        image: "alpine:latest",
        cmd: ["sh", "-c", "sleep 60"],
        labels: { "forge.test": "true" },
      });

      testContainers.push(container.id);
      await docker.start(container.id);

      await waitFor(
        async () => {
          const info = await docker.inspect(container.id);
          return info.state.running;
        },
        { timeout: 10000, message: "Container did not start" }
      );

      const beforeRestart = await docker.inspect(container.id);
      const startedAtBefore = beforeRestart.state.startedAt;

      await docker.restart(container.id);

      await waitFor(
        async () => {
          const info = await docker.inspect(container.id);
          return info.state.running;
        },
        { timeout: 10000, message: "Container did not restart" }
      );

      const afterRestart = await docker.inspect(container.id);
      expect(afterRestart.state.running).toBe(true);
      expect(afterRestart.state.startedAt?.getTime()).not.toBe(startedAtBefore?.getTime());
    }, 30000);
  });

  describe("Container Operations", () => {
    it("should execute commands in a container", async () => {
      const container = await docker.create({
        image: "alpine:latest",
        cmd: ["sh", "-c", "sleep 60"],
        labels: { "forge.test": "true" },
      });

      testContainers.push(container.id);
      await docker.start(container.id);

      await waitFor(
        async () => {
          const info = await docker.inspect(container.id);
          return info.state.running;
        },
        { timeout: 10000, message: "Container did not start" }
      );

      const result = await docker.exec(container.id, ["echo", "hello world"]);

      expect(result.exitCode).toBe(0);
      expect(result.output).toContain("hello world");
    }, 30000);

    it("should get container logs", async () => {
      const container = await docker.create({
        image: "alpine:latest",
        cmd: ["sh", "-c", 'echo "test log output" && sleep 30'],
        labels: { "forge.test": "true" },
      });

      testContainers.push(container.id);
      await docker.start(container.id);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const logs = await collectAsync(docker.logs(container.id, { tail: 10 }));

      expect(logs.length).toBeGreaterThan(0);
      expect(logs.some((log) => log.message.includes("test log output"))).toBe(true);
    }, 30000);

    it("should get container stats", async () => {
      const container = await docker.create({
        image: "alpine:latest",
        cmd: ["sh", "-c", "sleep 30"],
        labels: { "forge.test": "true" },
      });

      testContainers.push(container.id);
      await docker.start(container.id);

      await waitFor(
        async () => {
          const info = await docker.inspect(container.id);
          return info.state.running;
        },
        { timeout: 10000, message: "Container did not start" }
      );

      const stats = await docker.stats(container.id);

      expect(stats).toBeDefined();
      expect(stats.cpu).toBeDefined();
      expect(stats.memory).toBeDefined();
      expect(stats.memory.usage).toBeGreaterThan(0);
    }, 30000);
  });

  describe("Container Listing", () => {
    it("should list containers", async () => {
      const container = await docker.create({
        image: "alpine:latest",
        cmd: ["sh", "-c", "sleep 60"],
        labels: {
          "forge.test": "true",
          "forge.list.test": "unique-value",
        },
      });

      testContainers.push(container.id);

      const containers = await docker.list({
        label: {
          "forge.list.test": "unique-value",
        },
      });

      expect(containers.length).toBeGreaterThan(0);
      expect(containers.some((c) => c.id === container.id)).toBe(true);
    }, 30000);
  });

  describe("Network Management", () => {
    it("should create and list networks", async () => {
      const networkName = `forge-test-net-${Date.now()}`;

      const network = await docker.createNetwork({
        name: networkName,
        driver: "bridge",
        labels: { "forge.test": "true" },
      });

      testNetworks.push(network.id);

      expect(network).toBeDefined();
      expect(network.name).toBe(networkName);

      const networks = await docker.listNetworks({
        name: [networkName],
      });

      expect(networks.some((n) => n.name === networkName)).toBe(true);
    }, 30000);
  });

  describe("Volume Management", () => {
    it("should create and list volumes", async () => {
      const volumeName = `forge-test-vol-${Date.now()}`;

      const volume = await docker.createVolume({
        name: volumeName,
        labels: { "forge.test": "true" },
      });

      testVolumes.push(volume.name);

      expect(volume).toBeDefined();
      expect(volume.name).toBe(volumeName);

      const volumes = await docker.listVolumes({
        name: [volumeName],
      });

      expect(volumes.some((v) => v.name === volumeName)).toBe(true);
    }, 30000);
  });

  describe("Health Check", () => {
    it("should return healthy status when Docker is available", async () => {
      const health = await docker.healthCheck();

      expect(health.healthy).toBe(true);
      expect(health.version).toBeDefined();
    });
  });

  describe("Container with Port Mappings", () => {
    it("should create container with port mappings", async () => {
      const container = await docker.create({
        image: "nginx:alpine",
        name: `forge-test-nginx-${Date.now()}`,
        ports: [{ containerPort: 80 }],
        labels: { "forge.test": "true" },
      });

      testContainers.push(container.id);
      await docker.start(container.id);

      const info = await docker.inspect(container.id);

      expect(info.networkSettings.ports).toBeDefined();
      expect(info.networkSettings.ports["80/tcp"]).toBeDefined();
    }, 60000);
  });
});
