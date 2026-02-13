import { loadConfig as coreLoadConfig, type Config } from "@forge/core";

const DEV_SECRET_PATTERNS = [
  "change-me",
  "change",
  "dev-secret",
  "development-only",
  "secret123",
  "placeholder",
] as const;

export function loadConfig(): Config {
  const config = coreLoadConfig();

  if (config.nodeEnv === "production") {
    const jwtSecret = config.security.jwt.secret;

    // Check if JWT secret looks like a dev placeholder
    const normalizedSecret = jwtSecret.toLowerCase();
    const isDevSecret = DEV_SECRET_PATTERNS.some((pattern) => normalizedSecret.includes(pattern));

    if (isDevSecret) {
      console.error(`
╔════════════════════════════════════════════════════════════════╗
║  FATAL: INSECURE JWT_SECRET DETECTED IN PRODUCTION            ║
╠════════════════════════════════════════════════════════════════╣
║  The JWT_SECRET appears to be a development placeholder.         ║
║  Set a strong, random secret (min 32 chars) via:              ║
║  export JWT_SECRET="your-random-secret-here"                   ║
╚════════════════════════════════════════════════════════════════╝
      `);
      process.exit(1);
    }

    if (jwtSecret.length < 32) {
      console.error(`
╔════════════════════════════════════════════════════════════════╗
║  FATAL: JWT_SECRET TOO SHORT FOR PRODUCTION                     ║
╠════════════════════════════════════════════════════════════════╣
║  JWT_SECRET must be at least 32 characters. Current: ${jwtSecret.length}       ║
║  Generate one: openssl rand -base64 42                             ║
╚════════════════════════════════════════════════════════════════╝
      `);
      process.exit(1);
    }
  }

  return config;
}
