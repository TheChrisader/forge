import { PostgreSqlContainer, StartedPostgreSqlContainer } from "@testcontainers/postgresql";
import { PrismaClient } from "@forge/database";
import { PrismaPg } from "@prisma/adapter-pg";
import { execSync } from "child_process";
import { existsSync } from "fs";
import path from "path";

/**
 * Test database manager using Testcontainers
 * Provides isolated PostgreSQL instances for integration testing
 */
export class TestDatabase {
  private container?: StartedPostgreSqlContainer;
  private client?: PrismaClient;

  async start(): Promise<void> {
    this.container = await new PostgreSqlContainer("timescale/timescaledb:latest-pg17")
      .withDatabase("forge_test")
      .withUsername("forge_test")
      .withPassword("forge_test")
      .start();

    const connectionString = this.container.getConnectionUri();
    process.env.DATABASE_URL = connectionString;

    // Parse connection string and set individual PG environment variables
    // Required by @prisma/adapter-pg to avoid "password must be a string" errors
    this.setPgEnvVars(connectionString);

    const adapter = new PrismaPg({ url: connectionString });
    this.client = new PrismaClient({
      adapter,
      log: ["error"],
    });

    this.runMigrations();
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.$disconnect();
      this.client = undefined;
    }

    if (this.container) {
      await this.container.stop();
      this.container = undefined;
    }
  }

  async reset(): Promise<void> {
    if (!this.client) {
      throw new Error("Database not started. Call start() first.");
    }

    const tables = await this.client.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;

    for (const { tablename } of tables) {
      if (tablename !== "_prisma_migrations") {
        await this.client.$executeRawUnsafe(`TRUNCATE TABLE "${tablename}" CASCADE`);
      }
    }
  }

  getClient(): PrismaClient {
    if (!this.client) {
      throw new Error("Database not started. Call start() first.");
    }
    return this.client;
  }

  getConnectionString(): string {
    if (!this.container) {
      throw new Error("Database not started. Call start() first.");
    }
    return this.container.getConnectionUri();
  }

  getContainer(): StartedPostgreSqlContainer {
    if (!this.container) {
      throw new Error("Database not started. Call start() first.");
    }
    return this.container;
  }

  /**
   * Set individual PG environment variables from connection string
   * Required by @prisma/adapter-pg to avoid "password must be a string" errors
   */
  private setPgEnvVars(connectionString: string): void {
    try {
      const url = new URL(connectionString);
      process.env.PGHOST = url.hostname;
      process.env.PGPORT = url.port;
      process.env.PGUSER = url.username;
      process.env.PGPASSWORD = decodeURIComponent(url.password);
      process.env.PGDATABASE = url.pathname.slice(1);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to parse connection string: ${error.message}`);
      }
      // Log exception
      throw new Error(`Failed to parse connection string.`);
    }
  }

  private runMigrations(): void {
    const rootDir = this.findMonorepoRoot();

    try {
      execSync("pnpm --filter @forge/database db:migrate:deploy", {
        cwd: rootDir,
        env: {
          ...process.env,
          DATABASE_URL: this.getConnectionString(),
        },
        stdio: "pipe",
      });
    } catch (error) {
      const err = error as { stderr?: Buffer; message?: string };
      const stderr = err.stderr?.toString() || err.message || "Unknown error";
      console.error("Migration failed:", stderr);
      throw new Error(`Database migration failed: ${stderr}`);
    }
  }

  private findMonorepoRoot(): string {
    let dir = process.cwd();

    while (dir !== path.parse(dir).root) {
      if (existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
        return dir;
      }
      dir = path.dirname(dir);
    }
    throw new Error("Could not find monorepo root (pnpm-workspace.yaml not found)");
  }
}
