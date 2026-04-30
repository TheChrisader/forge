import { getDatabaseClient, closeDatabaseClient } from "./client";

async function testConnection(): Promise<void> {
  try {
    // eslint-disable-next-line no-console
    console.log("Checking database connection...");

    const db = getDatabaseClient();

    await db.$connect();
    // eslint-disable-next-line no-console
    console.log("✓ Connected to database");

    const result = await db.$queryRaw<Array<{ version: string }>>`
      SELECT version();
    `;
    // eslint-disable-next-line no-console
    console.log("✓ PostgreSQL version:", result[0].version);

    const timescale = await db.$queryRaw<Array<{ extversion: string }>>`
      SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
    `;
    // eslint-disable-next-line no-console
    console.log("✓ TimescaleDB version:", timescale[0]?.extversion || "Not installed");

    const project = await db.project.create({
      data: {
        name: "test-project",
        type: "nodejs",
        config: { framework: "express" },
      },
    });

    const projectID = project.id;
    // eslint-disable-next-line no-console
    console.log("✓ Created test project:", projectID);

    await db.project.delete({
      where: { id: project.id },
    });

    // eslint-disable-next-line no-console
    console.log("✓ Deleted test project:", projectID);

    // eslint-disable-next-line no-console
    console.log("\n✓ Database is ready and reachable.");
  } catch (error) {
    console.error("✗ Database test failed:", error);
    process.exit(1);
  } finally {
    await closeDatabaseClient();
  }
}

void testConnection();
