import "dotenv/config";

import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient | undefined;

/**
 * Set individual PG environment variables from connection string.
 * Required by @prisma/adapter-pg which uses the pg library that reads these env vars.
 */
function setPgEnvVars(connectionString: string): void {
  try {
    const url = new URL(connectionString);
    process.env.PGHOST = url.hostname;
    process.env.PGPORT = url.port;
    process.env.PGUSER = url.username;
    process.env.PGPASSWORD = decodeURIComponent(url.password);
    process.env.PGDATABASE = url.pathname.slice(1);
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse DATABASE_URL: ${error.message}`);
    }
    throw new Error("Failed to parse DATABASE_URL");
  }
}

export function getDatabaseClient(): PrismaClient {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

  // Set PG env vars from connection string
  // Required by @prisma/adapter-pg to avoid connection errors
  setPgEnvVars(url);

  const adapter = new PrismaPg({
    url,
  });

  if (!prisma) {
    prisma = new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
    });
  }

  return prisma;
}

export async function closeDatabaseClient(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = undefined;
  }
}

// Export the client class and type for use in other packages
export { PrismaClient, Prisma } from "./generated/client";
export type DatabaseClient = PrismaClient;
