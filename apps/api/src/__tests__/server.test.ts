import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createServer } from "../server.js";

vi.mock("@forge/cache", () => ({
  CacheModule: class {
    register(container: any): void {
      container.singleton("cache", () => ({
        get: vi.fn().mockResolvedValue(null),
        set: vi.fn().mockResolvedValue("OK"),
        del: vi.fn().mockResolvedValue(1),
        ping: vi.fn().mockResolvedValue("PONG"),
        quit: vi.fn().mockResolvedValue("OK"),
      }));
    }
  },
  disposeCacheModule: vi.fn(),
}));

vi.mock("@forge/queue", () => {
  const MockQueueService = class {
    addJob(): Promise<string> {
      return Promise.resolve("job-id");
    }
  };

  return {
    QueueModule: class {
      register(container: any): void {
        container.singleton("queue", () => new MockQueueService());
      }
    },
    QueueService: MockQueueService,
    disposeQueueModule: vi.fn(),
  };
});

const mockPrisma = {
  $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
  project: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
    update: vi.fn(),
  },
  deployment: {
    findUnique: vi.fn().mockResolvedValue(null),
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    create: vi.fn(),
    update: vi.fn(),
  },
};

vi.mock("@forge/database", () => ({
  PrismaClient: vi.fn().mockImplementation(() => mockPrisma),
}));

describe("Server Integration Tests", () => {
  let server: Awaited<ReturnType<typeof createServer>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma.$queryRaw.mockResolvedValue([{ "?column?": 1 }]);
    mockPrisma.project.findUnique.mockResolvedValue(null);
    mockPrisma.project.findMany.mockResolvedValue([]);
    mockPrisma.project.create.mockResolvedValue({} as any);
    mockPrisma.project.update.mockResolvedValue({} as any);
    mockPrisma.deployment.findUnique.mockResolvedValue(null);
    mockPrisma.deployment.findMany.mockResolvedValue([]);
    mockPrisma.deployment.count.mockResolvedValue(0);
    mockPrisma.deployment.create.mockResolvedValue({} as any);
    mockPrisma.deployment.update.mockResolvedValue({} as any);

    server = await createServer({ logger: false });
  });

  afterEach(async () => {
    if (server) {
      await server.close();
    }
  });

  describe("Health Endpoints", () => {
    it("GET /health returns ok status", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty("status", "ok");
      expect(payload).toHaveProperty("timestamp");
    });

    it("GET /health/ready returns ready with all checks", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/health/ready",
      });

      expect(response.statusCode).toBe(200);
      const payload = response.json();
      expect(payload).toHaveProperty("status", "ready");
      expect(payload).toHaveProperty("checks");
      expect(payload.checks).toHaveProperty("database");
      expect(payload.checks).toHaveProperty("redis");
    });
  });

  describe("Auth Endpoints", () => {
    describe("POST /api/auth/login", () => {
      it("returns token on successful login", async () => {
        const response = await server.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "admin@forge.local",
            password: "password",
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveProperty("accessToken");
        expect(payload).toHaveProperty("expiresIn");
        expect(payload).toHaveProperty("tokenType", "Bearer");
      });

      it("returns 401 on invalid email", async () => {
        const response = await server.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "wrong@test.com",
            password: "password",
          },
        });

        expect(response.statusCode).toBe(401);
        const payload = response.json();
        expect(payload.error).toHaveProperty("code", "UNAUTHORIZED");
      });

      it("returns 401 on invalid password", async () => {
        const response = await server.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "admin@forge.local",
            password: "wrongpassword",
          },
        });

        expect(response.statusCode).toBe(401);
        const payload = response.json();
        expect(payload.error).toHaveProperty("code", "UNAUTHORIZED");
      });
    });

    describe("POST /api/auth/api-keys", () => {
      it("requires authentication", async () => {
        const response = await server.inject({
          method: "POST",
          url: "/api/auth/api-keys",
        });

        expect(response.statusCode).toBe(401);
      });

      it("returns API key when authenticated", async () => {
        // First, login to get token
        const loginResponse = await server.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "admin@forge.local",
            password: "password",
          },
        });

        const { accessToken } = loginResponse.json();

        // Use token to create API key
        const response = await server.inject({
          method: "POST",
          url: "/api/auth/api-keys",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveProperty("key");
        expect(payload).toHaveProperty("createdAt");
        expect(payload).toHaveProperty("kid");
      });
    });

    describe("GET /api/auth/me", () => {
      it("requires authentication", async () => {
        const response = await server.inject({
          method: "GET",
          url: "/api/auth/me",
        });

        expect(response.statusCode).toBe(401);
      });

      it("returns user info when authenticated", async () => {
        const loginResponse = await server.inject({
          method: "POST",
          url: "/api/auth/login",
          payload: {
            email: "admin@forge.local",
            password: "password",
          },
        });

        const { accessToken } = loginResponse.json();

        const response = await server.inject({
          method: "GET",
          url: "/api/auth/me",
          headers: {
            authorization: `Bearer ${accessToken}`,
          },
        });

        expect(response.statusCode).toBe(200);
        const payload = response.json();
        expect(payload).toHaveProperty("userId", "admin@forge.local");
        expect(payload).toHaveProperty("role", "admin");
        expect(payload).toHaveProperty("authenticatedVia", "jwt");
      });
    });
  });

  // describe("Projects CRUD", () => {
  //   let authToken: string;

  //   beforeEach(async () => {
  //     const loginResponse = await server.inject({
  //       method: "POST",
  //       url: "/api/auth/login",
  //       payload: {
  //         email: "admin@forge.local",
  //         password: "password",
  //       },
  //     });
  //     authToken = loginResponse.json().accessToken;
  //   });

  //   describe("POST /api/projects", () => {
  //     it("creates a project successfully", async () => {
  //       const mockProject = {
  //         id: "550e8400-e29b-41d4-a716-446655440000",
  //         name: "test-project",
  //         type: "nextjs",
  //         status: "ACTIVE",
  //         config: {},
  //         metadata: {},
  //         teamId: null,
  //         sourceType: null,
  //         sourceUrl: null,
  //         deletedAt: null,
  //         createdAt: new Date(),
  //         updatedAt: new Date(),
  //         createdBy: "admin@forge.local",
  //         updatedBy: null,
  //       };

  //       (mockPrisma.project.create as any).mockResolvedValue(mockProject as Project);

  //       const response = await server.inject({
  //         method: "POST",
  //         url: "/api/projects",
  //         headers: {
  //           authorization: `Bearer ${authToken}`,
  //         },
  //         payload: {
  //           name: "test-project",
  //           type: "nextjs",
  //         },
  //       });

  //       expect(response.statusCode).toBe(201);
  //       const payload = response.json();
  //       expect(payload.data).toHaveProperty("id");
  //       expect(payload.data).toHaveProperty("name", "test-project");
  //     });
  //   });

  //   describe("GET /api/projects/:id", () => {
  //     it("returns 404 for non-existent project", async () => {
  //       (mockPrisma.project.findUnique as any).mockResolvedValue(null);

  //       const response = await server.inject({
  //         method: "GET",
  //         url: "/api/projects/550e8400-e29b-41d4-a716-446655440000",
  //         headers: {
  //           authorization: `Bearer ${authToken}`,
  //         },
  //       });

  //       expect(response.statusCode).toBe(404);
  //       const payload = response.json();
  //       expect(payload.error).toHaveProperty("code", "NOT_FOUND");
  //     });
  //   });

  //   describe("PUT /api/projects/:id", () => {
  //     it("updates a project successfully", async () => {
  //       const mockProject = {
  //         id: "550e8400-e29b-41d4-a716-446655440000",
  //         name: "updated-project",
  //         type: "nextjs",
  //         status: "ACTIVE",
  //         config: {},
  //         metadata: {},
  //         teamId: null,
  //         sourceType: null,
  //         sourceUrl: null,
  //         deletedAt: null,
  //         createdAt: new Date(),
  //         updatedAt: new Date(),
  //         createdBy: null,
  //         updatedBy: null,
  //       };

  //       (mockPrisma.project.findUnique as any).mockResolvedValue(mockProject as Project);
  //       (mockPrisma.project.update as any).mockResolvedValue(mockProject as Project);

  //       const response = await server.inject({
  //         method: "PUT",
  //         url: "/api/projects/550e8400-e29b-41d4-a716-446655440000",
  //         headers: {
  //           authorization: `Bearer ${authToken}`,
  //         },
  //         payload: {
  //           name: "updated-project",
  //         },
  //       });

  //       expect(response.statusCode).toBe(200);
  //     });
  //   });
  // });

  // describe("Deployment Trigger", () => {
  //   let authToken: string;

  //   beforeEach(async () => {
  //     const loginResponse = await server.inject({
  //       method: "POST",
  //       url: "/api/auth/login",
  //       payload: {
  //         email: "admin@forge.local",
  //         password: "password",
  //       },
  //     });
  //     authToken = loginResponse.json().accessToken;
  //   });

  //   it("POST /api/deployments/projects/:projectId/deployments returns 202", async () => {
  //     const mockDeployment = {
  //       id: "550e8400-e29b-41d4-a716-446655440001",
  //       projectId: "550e8400-e29b-41d4-a716-446655440000",
  //       version: 1,
  //       status: "PENDING",
  //       strategy: "ROLLING",
  //       canRollback: true,
  //       createdAt: new Date(),
  //       createdBy: null,
  //       updatedBy: null,
  //       deletedAt: null,
  //       environmentId: null,
  //       buildStartedAt: null,
  //       buildCompletedAt: null,
  //       buildImage: null,
  //       deployStartedAt: null,
  //       deployCompletedAt: null,
  //       blueEnvironmentId: null,
  //       greenEnvironmentId: null,
  //       activeEnvironment: null,
  //       canaryPercentage: null,
  //       canaryMetrics: null,
  //       rolledBackAt: null,
  //       rollbackReason: null,
  //       error: null,
  //       parentId: null,
  //     };

  //     (mockPrisma.project.findUnique as any).mockResolvedValue({
  //       id: "550e8400-e29b-41d4-a716-446655440000",
  //       name: "test-project",
  //       status: "ACTIVE",
  //       teamId: null,
  //       type: null,
  //       sourceType: null,
  //       sourceUrl: null,
  //       config: {},
  //       metadata: {},
  //       deletedAt: null,
  //       createdAt: new Date(),
  //       updatedAt: new Date(),
  //       createdBy: null,
  //       updatedBy: null,
  //     } as Project);
  //     (mockPrisma.$queryRaw as any).mockResolvedValue([{ acquired: true, has_active: false }]);
  //     (mockPrisma.deployment.create as any).mockResolvedValue(mockDeployment as Deployment);

  //     const response = await server.inject({
  //       method: "POST",
  //       url: "/api/deployments/projects/550e8400-e29b-41d4-a716-446655440000/deployments",
  //       headers: {
  //         authorization: `Bearer ${authToken}`,
  //       },
  //     });

  //     expect(response.statusCode).toBe(202);
  //     const payload = response.json();
  //     expect(payload.data).toHaveProperty("status", "PENDING");
  //   });
  // });

  describe("404 Handler", () => {
    it("returns 404 for non-existent routes", async () => {
      const response = await server.inject({
        method: "GET",
        url: "/api/non-existent",
      });

      expect(response.statusCode).toBe(404);
      const payload = response.json();
      expect(payload.error).toHaveProperty("code", "VALIDATION_ERROR");
      expect(payload.error).toHaveProperty("message", "Resource not found");
    });
  });
});
