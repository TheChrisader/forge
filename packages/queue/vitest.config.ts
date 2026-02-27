/**
 * Vitest configuration for the queue package
 */

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    exclude: ["node_modules", "dist", "**/*.integration.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
    // Pool options to prevent memory issues
    pool: "threads",
    includeSource: ["src/**/*.ts"],
  },
});
