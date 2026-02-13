import crypto from "node:crypto";
import { UnauthorizedError } from "@forge/core";
import type { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
    authenticatedVia?: "jwt" | "api_key";
  }
}

export interface ApiKeyPayload {
  userId: string;
  createdAt: number;
  kid: string;
}

/**
 * Creates an HMAC-SHA256 API key with format: base64url(payload).hex_signature
 * The signature is computed over the payload to prevent tampering
 *
 * @param userId - User ID to associate with the API key
 * @param secret - Secret key used for HMAC signature
 * @returns Formatted API key string
 */
export function createApiKey(userId: string, secret: string): string {
  const payload: ApiKeyPayload = {
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
 * Verifies an API key by validating its HMAC signature
 * Uses timing-safe comparison to prevent timing attacks
 *
 * @param token - API key token to verify
 * @param secret - Secret key used for HMAC verification
 * @returns ApiKeyPayload if valid, null otherwise (never throws)
 */
export function verifyApiKey(token: string, secret: string): ApiKeyPayload | null {
  try {
    const [payloadBase64, signature] = token.split(".");

    if (!payloadBase64 || !signature) {
      return null;
    }

    const payloadBuffer = Buffer.from(payloadBase64, "base64url");
    const payloadJson = payloadBuffer.toString("utf-8");
    const payload = JSON.parse(payloadJson) as ApiKeyPayload;

    if (!payload.userId || !payload.createdAt || !payload.kid) {
      return null;
    }

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payloadBuffer);
    const expectedSignature = hmac.digest("hex");

    const signatureBuffer = Buffer.from(signature, "utf-8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf-8");

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Extracts Bearer token from Authorization header
 *
 * @param header - Authorization header value
 * @returns Token string or null if header is malformed/missing
 */
export function extractBearerToken(header: string | undefined): string | null {
  if (!header) {
    return null;
  }

  const parts = header.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return null;
  }

  return parts[1];
}

/**
 * Asserts that userId is defined and throws UnauthorizedError if not
 * This is what route handlers call to require authentication
 *
 * @param userId - User ID from request.userId
 * @returns The userId (throws if undefined)
 * @throws UnauthorizedError if userId is undefined
 */
export function requireAuth(userId: string | undefined): string {
  if (userId === undefined) {
    throw new UnauthorizedError("Authentication required");
  }

  return userId;
}

export function isAuthenticated(req: FastifyRequest): req is FastifyRequest & {
  userId: string;
} {
  return req.userId !== undefined;
}
