import jwt from "jsonwebtoken";
import crypto from "node:crypto";

/**
 * Create a JWT token that the Forge API will accept.
 * The API uses @fastify/jwt which expects { id: string } in the payload.
 */
export function createTestJwt(
  payload: { id: string; email?: string },
  secret: string,
  options?: { expiresIn?: string }
): string {
  return jwt.sign(payload, secret, {
    expiresIn: (options?.expiresIn ?? "15m") as jwt.SignOptions["expiresIn"],
    issuer: "forge",
  });
}

/**
 * Create an API key that the Forge API will accept.
 * Mirrors the HMAC-SHA256 format from apps/api/src/middleware/auth.ts.
 */
export function createTestApiKey(userId: string, secret: string): string {
  const payload = {
    userId,
    createdAt: Date.now(),
    kid: crypto.randomBytes(16).toString("hex"),
  };

  const payloadBuffer = Buffer.from(JSON.stringify(payload), "utf-8");
  const payloadBase64 = payloadBuffer.toString("base64url");

  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payloadBuffer);
  const signature = hmac.digest("hex");

  return `${payloadBase64}.${signature}`;
}

/**
 * Build Authorization header with a Bearer JWT token.
 */
export function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}` };
}

/**
 * Build API key header (default: x-api-key).
 */
export function apiKeyHeaders(
  apiKey: string,
  header: string = "x-api-key"
): Record<string, string> {
  return { [header]: apiKey };
}
