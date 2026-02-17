import type { Prisma } from "@forge/database";

/**
 * Converts TypeScript data to Prisma InputJsonValue type.
 * Useful for passing JSON data to Prisma queries.
 *
 * @param data - The data to convert
 * @returns The data as Prisma.InputJsonValue
 *
 * @example
 * ```ts
 * await prisma.project.create({
 *   data: {
 *     name: "my-project",
 *     config: toPrismaJson({ key: "value" }),
 *   },
 * });
 * ```
 */
export function toPrismaJson<T>(data: T): Prisma.InputJsonValue {
  return data as Prisma.InputJsonValue;
}
