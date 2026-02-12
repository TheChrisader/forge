import "dotenv/config";

import { PrismaClient } from "./generated/client";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: PrismaClient | undefined;

export function getDatabaseClient(): PrismaClient {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error("Missing DATABASE_URL environment variable");
  }

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
