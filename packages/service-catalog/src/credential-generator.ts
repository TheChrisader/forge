import { randomBytes } from "node:crypto";
import type { ServiceType } from "@forge/database";
import type { GeneratedCredentials } from "./types";

const CHARSET_ALPHA_NUMERIC = "abcdefghijklmnopqrstuvwxyz0123456789";
const CHARSET_PASSWORD = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";

function randomString(length: number, charset: string): string {
  const bytes = randomBytes(length);
  let result = "";
  for (let i = 0; i < length; i++) {
    result += charset[bytes[i] % charset.length];
  }
  return result;
}

function sanitizeForDatabase(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .substring(0, 63) || "db"
  );
}

export function generateCredentials(
  serviceType: ServiceType,
  engine: string,
  serviceName: string
): GeneratedCredentials {
  const baseUsername = engine.replace(/[^a-z0-9]/g, "").substring(0, 8);
  const username = `${baseUsername}_${randomString(4, CHARSET_ALPHA_NUMERIC)}`;
  const password = randomString(24, CHARSET_PASSWORD);
  const database = sanitizeForDatabase(serviceName);

  if (serviceType === "CACHE") {
    return { username: "default", password, database: "0" };
  }

  if (serviceType === "QUEUE") {
    return { username, password, database: "/" };
  }

  return { username, password, database };
}
