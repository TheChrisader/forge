import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    // Setup files for integration tests
    setupFiles: ["./tests/integration/setup.ts"],
    // Include both unit and integration tests
    include: ["src/**/*.test.ts", "src/**/*.spec.ts", "tests/**/*.test.ts"],
    // Exclude patterns
    exclude: ["node_modules", "dist"],
    // Timeouts for container startup and slow tests
    // TimescaleDB requires longer startup time than standard PostgreSQL
    testTimeout: 60000,
    hookTimeout: 180000, // 3 minutes for TimescaleDB container startup
    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      exclude: [
        "node_modules/",
        "dist/",
        "**/*.test.ts",
        "**/*.spec.ts",
        "tests/",
        "packages/test-utils/",
      ],
    },
    // Pool configuration for parallel tests
    pool: "threads",
    singleThread: false,
    minThreads: 1,
    maxThreads: 4,
  },
});
