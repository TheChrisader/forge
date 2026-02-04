import { getDatabaseClient, closeDatabaseClient } from "./client";

async function testConnection(): Promise<void> {
  try {
    console.log("Testing database connection...");

    const db = getDatabaseClient();

    // Test connection
    await db.$connect();
    console.log("✓ Connected to database");

    // Test query
    const result = await db.$queryRaw<Array<{ version: string }>>`
      SELECT version();
    `;
    console.log("✓ PostgreSQL version:", result[0].version);

    // Test TimescaleDB
    const timescale = await db.$queryRaw<Array<{ extversion: string }>>`
      SELECT extversion FROM pg_extension WHERE extname = 'timescaledb';
    `;
    console.log("✓ TimescaleDB version:", timescale[0]?.extversion || "Not installed");

    // Test creating a project
    const project = await db.project.create({
      data: {
        name: "test-project",
        type: "nodejs",
        config: { framework: "express" },
      },
    });
    console.log("✓ Created test project:", project.id);

    // Clean up test project
    await db.project.delete({
      where: { id: project.id },
    });
    console.log("✓ Cleaned up test project");

    console.log("\n✓ All database tests passed!");
  } catch (error) {
    console.error("✗ Database test failed:", error);
    process.exit(1);
  } finally {
    await closeDatabaseClient();
  }
}

testConnection();
