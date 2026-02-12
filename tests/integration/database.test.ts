import { describe, it, expect } from "vitest";
import { testDb } from "./setup";
import { createTestProject } from "@forge/test-utils";
import { Prisma } from "@forge/database";

describe("Database Integration", () => {
  describe("Project operations", () => {
    it("should create and retrieve a project", async () => {
      const db = testDb.getClient();

      const projectData = createTestProject();

      const created = await db.project.create({
        data: {
          name: projectData.name,
          type: projectData.type,
          status: projectData.status,
          config: projectData.config as Prisma.InputJsonValue,
          metadata: projectData.metadata as Prisma.InputJsonValue,
        },
      });

      expect(created).toBeDefined();
      expect(created.id).toBeDefined();
      expect(created.name).toBe(projectData.name);
      expect(created.type).toBe(projectData.type);

      const retrieved = await db.project.findUnique({
        where: { id: created.id },
      });

      expect(retrieved).toBeDefined();
      expect(retrieved?.name).toBe(projectData.name);
    });

    it("should update a project", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "Original Name",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
        },
      });

      const updated = await db.project.update({
        where: { id: project.id },
        data: {
          name: "Updated Name",
          status: "inactive",
        },
      });

      expect(updated.name).toBe("Updated Name");
      expect(updated.status).toBe("inactive");
    });

    it("should delete a project", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "To Delete",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
        },
      });

      await db.project.delete({
        where: { id: project.id },
      });

      const deleted = await db.project.findUnique({
        where: { id: project.id },
      });

      expect(deleted).toBeNull();
    });

    it("should list projects with pagination", async () => {
      const db = testDb.getClient();

      await db.project.createMany({
        data: [
          { name: "Project 1", type: "nodejs", status: "active", config: {}, metadata: {} },
          { name: "Project 2", type: "nodejs", status: "active", config: {}, metadata: {} },
          { name: "Project 3", type: "nodejs", status: "active", config: {}, metadata: {} },
        ],
      });

      const page1 = await db.project.findMany({
        take: 2,
        orderBy: { createdAt: "desc" },
      });

      expect(page1).toHaveLength(2);
    });
  });

  describe("Deployment operations", () => {
    it("should create a deployment for a project", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "Test Project",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
        },
      });

      const deployment = await db.deployment.create({
        data: {
          projectId: project.id,
          version: "v1.0.0",
          status: "pending",
        },
      });

      expect(deployment).toBeDefined();
      expect(deployment.projectId).toBe(project.id);
      expect(deployment.version).toBe("v1.0.0");

      const projectWithDeployments = await db.project.findUnique({
        where: { id: project.id },
        include: { deployments: true },
      });

      expect(projectWithDeployments?.deployments).toHaveLength(1);
      expect(projectWithDeployments?.deployments[0].id).toBe(deployment.id);
    });

    it("should update deployment status", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "Test Project",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
        },
      });

      const deployment = await db.deployment.create({
        data: {
          projectId: project.id,
          version: "v1.0.0",
          status: "pending",
        },
      });

      const updated = await db.deployment.update({
        where: { id: deployment.id },
        data: {
          status: "running",
          deployStartedAt: new Date(),
        },
      });

      expect(updated.status).toBe("running");
      expect(updated.deployStartedAt).toBeDefined();
    });

    it("should delete a project and cascade to deployments", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "Test Project",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
          deployments: {
            create: {
              version: "v1.0.0",
              status: "pending",
            },
          },
        },
        include: { deployments: true },
      });

      await db.project.delete({
        where: { id: project.id },
      });

      const deletedProject = await db.project.findUnique({
        where: { id: project.id },
      });
      expect(deletedProject).toBeNull();

      const deployments = await db.deployment.findMany({
        where: { projectId: project.id },
      });
      expect(deployments).toHaveLength(0);
    });
  });

  describe("Container operations", () => {
    it("should create a container for a deployment", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "Test Project",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
        },
      });

      const deployment = await db.deployment.create({
        data: {
          projectId: project.id,
          version: "v1.0.0",
          status: "running",
        },
      });

      const container = await db.container.create({
        data: {
          projectId: project.id,
          deploymentId: deployment.id,
          containerId: `docker-${Date.now()}`,
          name: "app-container-1",
          image: "node:20-alpine",
          status: "running",
        },
      });

      expect(container).toBeDefined();
      expect(container.deploymentId).toBe(deployment.id);
      expect(container.name).toBe("app-container-1");

      const deploymentWithContainers = await db.deployment.findUnique({
        where: { id: deployment.id },
        include: { containers: true },
      });

      expect(deploymentWithContainers?.containers).toHaveLength(1);
    });

    it("should update container status", async () => {
      const db = testDb.getClient();

      const project = await db.project.create({
        data: {
          name: "Test Project",
          type: "nodejs",
          status: "active",
          config: {},
          metadata: {},
        },
      });

      const deployment = await db.deployment.create({
        data: {
          projectId: project.id,
          version: "v1.0.0",
          status: "running",
        },
      });

      const container = await db.container.create({
        data: {
          projectId: project.id,
          deploymentId: deployment.id,
          containerId: `docker-${Date.now()}`,
          name: "app-container-1",
          image: "node:20-alpine",
          status: "running",
        },
      });

      const updated = await db.container.update({
        where: { id: container.id },
        data: { status: "stopped" },
      });

      expect(updated.status).toBe("stopped");
    });
  });

  describe("Transaction support", () => {
    it("should support transactions", async () => {
      const db = testDb.getClient();

      await db.$transaction(async (tx: Prisma.TransactionClient) => {
        const project = await tx.project.create({
          data: {
            name: "Transaction Test",
            type: "nodejs",
            status: "active",
            config: {},
            metadata: {},
          },
        });

        await tx.deployment.create({
          data: {
            projectId: project.id,
            version: "v1.0.0",
            status: "pending",
          },
        });
      });

      const project = await db.project.findFirst({
        where: { name: "Transaction Test" },
        include: { deployments: true },
      });

      expect(project).toBeDefined();
      expect(project?.deployments).toHaveLength(1);
    });

    it("should rollback on error", async () => {
      const db = testDb.getClient();

      try {
        await db.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.project.create({
            data: {
              name: "Rollback Test",
              type: "nodejs",
              status: "active",
              config: {},
              metadata: {},
            },
          });

          throw new Error("Intentional error");
        });
      } catch {
        // TODO: Log
      }

      const project = await db.project.findFirst({
        where: { name: "Rollback Test" },
      });

      expect(project).toBeNull();
    });
  });
});
