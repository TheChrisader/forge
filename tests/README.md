# Forge Testing Guide

This guide covers the testing infrastructure and best practices for the Forge platform.

## Test Structure

```
tests/
├── integration/           # Integration tests
│   ├── setup.ts          # Global test environment setup
│   ├── database.test.ts  # Database integration tests
│   ├── docker.test.ts    # Docker integration tests
│   ├── queue.test.ts     # Queue integration tests
│   └── contracts/        # Contract tests for interfaces
│       └── storage.test.ts
└── e2e/                  # End-to-end tests (future)

packages/
├── test-utils/           # Shared testing utilities
│   └── src/
│       ├── database.ts   # TestDatabase class
│       ├── redis.ts      # TestRedis class
│       ├── factories.ts  # Test data factories
│       └── helpers.ts    # Test helpers
└── */src/**/*.test.ts    # Unit tests alongside source
```

## Running Tests

```bash
# Run all tests
pnpm test

# Run vitest directly
pnpm test:run

# Run in watch mode
pnpm test:watch

# Run with UI
pnpm test:ui

# Run with coverage
pnpm test:coverage

# Run only integration tests
pnpm test:integration

# Run only unit tests
pnpm test:unit
```

## Test Utilities

### TestDatabase

The `TestDatabase` class provides an isolated PostgreSQL instance using Testcontainers.

```typescript
import { TestDatabase } from "@forge/test-utils";

const testDb = new TestDatabase();

beforeAll(async () => {
  await testDb.start();
});

afterAll(async () => {
  await testDb.stop();
});

beforeEach(async () => {
  await testDb.reset();
});

// Get Prisma client
const db = testDb.getClient();
```

### TestRedis

The `TestRedis` class provides an isolated Redis instance using Testcontainers.

```typescript
import { TestRedis } from "@forge/test-utils";

const testRedis = new TestRedis();

beforeAll(async () => {
  await testRedis.start();
});

afterAll(async () => {
  await testRedis.stop();
});

beforeEach(async () => {
  await testRedis.reset();
});

// Get Redis client
const redis = testRedis.getClient();

// Get config for QueueClient
const config = { redis: testRedis.getConfig() };
```

### Test Data Factories

Factories create consistent test data:

```typescript
import {
  createTestProject,
  createTestDeployment,
  createTestContainer,
  createTestService,
  resetFactories,
} from "@forge/test-utils";

// Reset counters between tests
beforeEach(() => {
  resetFactories();
});

// Create test data
const projectData = createTestProject({ name: "My Project" });
const deploymentData = createTestDeployment({ projectId: projectData.id });
```

### Test Helpers

```typescript
import { waitFor, retry, sleep, createMock } from "@forge/test-utils";

// Wait for a condition
await waitFor(
  async () => {
    const info = await docker.inspect(containerId);
    return info.state.running;
  },
  { timeout: 10000, message: "Container did not start" }
);

// Retry an operation
const result = await retry(() => fetchData(), {
  maxAttempts: 3,
  delay: 1000,
  backoff: true,
});

// Simple sleep (use sparingly)
await sleep(1000);

// Create a mock function
const mock = createMock<(data: string) => void>();
mock("test");
expect(mock.callCount()).toBe(1);
expect(mock.wasCalledWith("test")).toBe(true);
```

## Writing Tests

### Unit Tests

Place unit tests next to the code they test:

```
packages/docker/src/
├── runtime/
│   ├── docker.ts
│   └── docker.test.ts
```

Example unit test:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { MyClass } from "./my-class";

describe("MyClass", () => {
  let instance: MyClass;

  beforeEach(() => {
    instance = new MyClass();
  });

  it("should do something", () => {
    expect(instance.doSomething()).toBe(true);
  });
});
```

### Integration Tests

Place integration tests in `tests/integration/`:

```typescript
import { describe, it, expect } from "vitest";
import { testDb } from "./setup";
import { createTestProject } from "@forge/test-utils";

describe("Feature Integration", () => {
  it("should test integration", async () => {
    const db = testDb.getClient();
    const projectData = createTestProject();

    const project = await db.project.create({
      data: projectData,
    });

    expect(project.id).toBeDefined();
  });
});
```

### Contract Tests

Contract tests verify that implementations conform to interfaces:

```typescript
import { testStorageProviderContract } from "./contracts/storage.test";
import { LocalStorageProvider } from "./providers/local";

describe("LocalStorageProvider", () => {
  testStorageProviderContract(async () => {
    return new LocalStorageProvider({ basePath: "/tmp/test" });
  });
});
```

## Test Configuration

Tests are configured in `vitest.config.ts`:

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/integration/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
    },
  },
});
```

## CI/CD

Tests run automatically on:

- Every push to `main` or `develop`
- Every pull request

The CI pipeline runs:

1. **Lint** - Code style and formatting checks
2. **Type Check** - TypeScript validation
3. **Unit Tests** - Fast, isolated tests
4. **Integration Tests** - Full integration tests with containers
5. **Build** - Verify all packages build successfully

## Best Practices

### 1. Isolate Tests

Each test should be independent:

```typescript
// Bad: Tests depend on each other
it("creates a project", async () => {
  sharedProject = await createProject();
});

it("deploys the project", async () => {
  await deploy(sharedProject); // Depends on previous test
});

// Good: Each test is self-contained
it("deploys a project", async () => {
  const project = await createProject();
  await deploy(project);
});
```

### 2. Use Factories

Don't hardcode test data:

```typescript
// Bad
const project = { id: "1", name: "Test", type: "nodejs" };

// Good
const project = createTestProject({ name: "My Test" });
```

### 3. Clean Up Resources

Always clean up Docker containers and test data:

```typescript
afterAll(async () => {
  await container.stop();
  await container.remove();
});
```

### 4. Keep Tests Fast

- Use unit tests for logic
- Use integration tests for real workflows
- Avoid unnecessary waits

```typescript
// Bad
await sleep(5000);

// Good
await waitFor(() => container.running, { timeout: 10000 });
```

### 5. Descriptive Names

```typescript
// Bad
it("works", () => {});

// Good
it("should return 404 when project does not exist", () => {});
```

### 6. Minimal Possible Assertions Per Test

```typescript
// Bad
it("should validate input", () => {
  expect(result.name).toBe("test");
  expect(result.status).toBe("active");
  expect(result.config).toBeDefined();
});

// Good
it("should set the name", () => {
  expect(result.name).toBe("test");
});

it("should set status to active", () => {
  expect(result.status).toBe("active");
});
```

### 7. AAA Pattern

```typescript
it("should calculate total", () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(30);
});
```

## Debugging Tests

```bash
# Run specific test file
pnpm test tests/integration/database.test.ts

# Run specific test by name
pnpm test -t "should create and retrieve a project"

# Enable debug logging
DEBUG=* pnpm test

# Run with verbose output
pnpm test --reporter=verbose
```

## Troubleshooting

### Testcontainers Issues

If tests fail to start containers:

1. Ensure Docker is running
2. Check Docker has enough resources (memory, CPU)
3. Pull required images manually: `docker pull postgres:17-alpine`

### Database Migration Issues

If migrations fail in tests:

```bash
# Generate Prisma client
pnpm db:generate

# Check migrations are valid
pnpm --filter @forge/database db:migrate:deploy --help
```

### Redis Connection Issues

If Redis tests fail:

1. Check Redis container is accessible
2. Verify port is not already in use
3. Check test setup runs before tests

## Coverage

Generate coverage reports:

```bash
pnpm test:coverage
```

Reports are saved to `coverage/`:

- `coverage/index.html` - HTML report
- `coverage/lcov.info` - LCOV format for CI
- `coverage/coverage-final.json` - JSON format
