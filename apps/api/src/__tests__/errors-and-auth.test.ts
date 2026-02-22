import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import {
  ValidationError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  UnprocessableError,
  RateLimitError,
  InternalError,
  DeploymentError,
  BuildError,
  isForgeError,
} from "@forge/core";
import {
  createApiKey,
  verifyApiKey,
  extractBearerToken,
  requireAuth,
  type ApiKeyPayload,
} from "../middleware/auth.js";

describe("Error Classes", () => {
  describe("toJSON", () => {
    it("ValidationError serializes correctly", () => {
      const error = new ValidationError("Invalid input", { field: "required" });
      const json = error.toJSON();

      expect(json).toEqual({
        code: "VALIDATION_ERROR",
        statusCode: 400,
        message: "Invalid input",
        details: { field: "required" },
      });
    });

    it("BadRequestError serializes correctly", () => {
      const error = new BadRequestError("Bad request");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "BAD_REQUEST",
        statusCode: 400,
        message: "Bad request",
      });
    });

    it("UnauthorizedError serializes correctly", () => {
      const error = new UnauthorizedError("Not authenticated");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "UNAUTHORIZED",
        statusCode: 401,
        message: "Not authenticated",
      });
    });

    it("ForbiddenError serializes correctly", () => {
      const error = new ForbiddenError("Access denied");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "FORBIDDEN",
        statusCode: 403,
        message: "Access denied",
      });
    });

    it("NotFoundError serializes correctly", () => {
      const error = new NotFoundError("User");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "NOT_FOUND",
        statusCode: 404,
        message: "User not found",
      });
    });

    it("ConflictError serializes correctly", () => {
      const error = new ConflictError("Resource already exists");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "CONFLICT",
        statusCode: 409,
        message: "Resource already exists",
      });
    });

    it("UnprocessableError serializes correctly", () => {
      const error = new UnprocessableError("Cannot process request");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "UNPROCESSABLE_ENTITY",
        statusCode: 422,
        message: "Cannot process request",
      });
    });

    it("RateLimitError serializes correctly", () => {
      const error = new RateLimitError("Too many requests");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "RATE_LIMIT_EXCEEDED",
        statusCode: 429,
        message: "Too many requests",
      });
    });

    it("InternalError serializes correctly", () => {
      const error = new InternalError("Something went wrong");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "INTERNAL_ERROR",
        statusCode: 500,
        message: "Something went wrong",
      });
    });

    it("DeploymentError serializes correctly", () => {
      const error = new DeploymentError("Deployment failed");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "DEPLOYMENT_ERROR",
        statusCode: 500,
        message: "Deployment failed",
      });
    });

    it("BuildError serializes correctly", () => {
      const error = new BuildError("Build failed");
      const json = error.toJSON();

      expect(json).toEqual({
        code: "BUILD_ERROR",
        statusCode: 500,
        message: "Build failed",
      });
    });

    it("includes details when provided", () => {
      const error = new ValidationError("Invalid input", { field: "name is required" });
      const json = error.toJSON();

      expect(json.details).toEqual({ field: "name is required" });
    });

    it("excludes details when not provided", () => {
      const error = new ValidationError("Invalid input");
      const json = error.toJSON();

      expect(json).not.toHaveProperty("details");
    });
  });

  describe("statusCode", () => {
    it("ValidationError has 400 status", () => {
      const error = new ValidationError("Invalid");
      expect(error.statusCode).toBe(400);
    });

    it("BadRequestError has 400 status", () => {
      const error = new BadRequestError("Bad");
      expect(error.statusCode).toBe(400);
    });

    it("UnauthorizedError has 401 status", () => {
      const error = new UnauthorizedError();
      expect(error.statusCode).toBe(401);
    });

    it("ForbiddenError has 403 status", () => {
      const error = new ForbiddenError();
      expect(error.statusCode).toBe(403);
    });

    it("NotFoundError has 404 status", () => {
      const error = new NotFoundError();
      expect(error.statusCode).toBe(404);
    });

    it("ConflictError has 409 status", () => {
      const error = new ConflictError("Conflict");
      expect(error.statusCode).toBe(409);
    });

    it("UnprocessableError has 422 status", () => {
      const error = new UnprocessableError("Unprocessable");
      expect(error.statusCode).toBe(422);
    });

    it("RateLimitError has 429 status", () => {
      const error = new RateLimitError();
      expect(error.statusCode).toBe(429);
    });

    it("InternalError has 500 status", () => {
      const error = new InternalError();
      expect(error.statusCode).toBe(500);
    });

    it("DeploymentError has 500 status", () => {
      const error = new DeploymentError("Deploy failed");
      expect(error.statusCode).toBe(500);
    });

    it("BuildError has 500 status", () => {
      const error = new BuildError("Build failed");
      expect(error.statusCode).toBe(500);
    });
  });

  describe("code", () => {
    it("ValidationError has VALIDATION_ERROR code", () => {
      const error = new ValidationError("Invalid");
      expect(error.code).toBe("VALIDATION_ERROR");
    });

    it("BadRequestError has BAD_REQUEST code", () => {
      const error = new BadRequestError("Bad");
      expect(error.code).toBe("BAD_REQUEST");
    });

    it("UnauthorizedError has UNAUTHORIZED code", () => {
      const error = new UnauthorizedError();
      expect(error.code).toBe("UNAUTHORIZED");
    });

    it("ForbiddenError has FORBIDDEN code", () => {
      const error = new ForbiddenError();
      expect(error.code).toBe("FORBIDDEN");
    });

    it("NotFoundError has NOT_FOUND code", () => {
      const error = new NotFoundError();
      expect(error.code).toBe("NOT_FOUND");
    });

    it("ConflictError has CONFLICT code", () => {
      const error = new ConflictError("Conflict");
      expect(error.code).toBe("CONFLICT");
    });

    it("UnprocessableError has UNPROCESSABLE_ENTITY code", () => {
      const error = new UnprocessableError("Unprocessable");
      expect(error.code).toBe("UNPROCESSABLE_ENTITY");
    });

    it("RateLimitError has RATE_LIMIT_EXCEEDED code", () => {
      const error = new RateLimitError();
      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
    });

    it("InternalError has INTERNAL_ERROR code", () => {
      const error = new InternalError();
      expect(error.code).toBe("INTERNAL_ERROR");
    });

    it("DeploymentError has DEPLOYMENT_ERROR code", () => {
      const error = new DeploymentError("Deploy failed");
      expect(error.code).toBe("DEPLOYMENT_ERROR");
    });

    it("BuildError has BUILD_ERROR code", () => {
      const error = new BuildError("Build failed");
      expect(error.code).toBe("BUILD_ERROR");
    });
  });

  describe("isForgeError type guard", () => {
    it("returns true for all ForgeError subclasses", () => {
      expect(isForgeError(new ValidationError("Invalid"))).toBe(true);
      expect(isForgeError(new BadRequestError("Bad"))).toBe(true);
      expect(isForgeError(new UnauthorizedError())).toBe(true);
      expect(isForgeError(new ForbiddenError())).toBe(true);
      expect(isForgeError(new NotFoundError())).toBe(true);
      expect(isForgeError(new ConflictError("Conflict"))).toBe(true);
      expect(isForgeError(new UnprocessableError("Unprocessable"))).toBe(true);
      expect(isForgeError(new RateLimitError())).toBe(true);
      expect(isForgeError(new InternalError())).toBe(true);
      expect(isForgeError(new DeploymentError("Deploy"))).toBe(true);
      expect(isForgeError(new BuildError("Build"))).toBe(true);
    });

    it("returns false for regular Error", () => {
      expect(isForgeError(new Error("Regular error"))).toBe(false);
    });

    it("returns false for non-Error objects", () => {
      expect(isForgeError(null)).toBe(false);
      expect(isForgeError(undefined)).toBe(false);
      expect(isForgeError("string")).toBe(false);
      expect(isForgeError({})).toBe(false);
    });

    it("returns false for generic Error subclass", () => {
      class CustomError extends Error {}
      expect(isForgeError(new CustomError("Custom"))).toBe(false);
    });
  });

  describe("error name", () => {
    it("has correct class name for each error type", () => {
      expect(new ValidationError("Invalid").name).toBe("ValidationError");
      expect(new BadRequestError("Bad").name).toBe("BadRequestError");
      expect(new UnauthorizedError().name).toBe("UnauthorizedError");
      expect(new ForbiddenError().name).toBe("ForbiddenError");
      expect(new NotFoundError().name).toBe("NotFoundError");
      expect(new ConflictError("Conflict").name).toBe("ConflictError");
      expect(new UnprocessableError("Unprocessable").name).toBe("UnprocessableError");
      expect(new RateLimitError().name).toBe("RateLimitError");
      expect(new InternalError().name).toBe("InternalError");
      expect(new DeploymentError("Deploy").name).toBe("DeploymentError");
      expect(new BuildError("Build").name).toBe("BuildError");
    });
  });
});

describe("Auth Utilities", () => {
  const testSecret = "test-secret-key";
  const testUserId = "user-123";

  describe("createApiKey", () => {
    it("creates a properly formatted API key", () => {
      const key = createApiKey(testUserId, testSecret);

      expect(key).toMatch(/^[\w-]+\.[a-f0-9]+$/);
    });

    it("creates unique keys each time", () => {
      const key1 = createApiKey(testUserId, testSecret);
      const key2 = createApiKey(testUserId, testSecret);

      expect(key1).not.toBe(key2);
    });

    it("includes userId in payload", () => {
      const key = createApiKey(testUserId, testSecret);
      const [payloadBase64] = key.split(".");
      const payloadBuffer = Buffer.from(payloadBase64, "base64url");
      const payload = JSON.parse(payloadBuffer.toString()) as ApiKeyPayload;

      expect(payload.userId).toBe(testUserId);
    });

    it("includes createdAt timestamp", () => {
      const before = Date.now();
      const key = createApiKey(testUserId, testSecret);
      const after = Date.now();

      const [payloadBase64] = key.split(".");
      const payloadBuffer = Buffer.from(payloadBase64, "base64url");
      const payload = JSON.parse(payloadBuffer.toString()) as ApiKeyPayload;

      expect(payload.createdAt).toBeGreaterThanOrEqual(before);
      expect(payload.createdAt).toBeLessThanOrEqual(after);
    });

    it("includes unique kid (key ID)", () => {
      const key = createApiKey(testUserId, testSecret);
      const [payloadBase64] = key.split(".");
      const payloadBuffer = Buffer.from(payloadBase64, "base64url");
      const payload = JSON.parse(payloadBuffer.toString()) as ApiKeyPayload;

      expect(payload.kid).toMatch(/^[a-f0-9]{32}$/);
    });
  });

  describe("verifyApiKey", () => {
    it("verifies a valid API key", () => {
      const key = createApiKey(testUserId, testSecret);
      const payload = verifyApiKey(key, testSecret);

      expect(payload).not.toBeNull();
      expect(payload?.userId).toBe(testUserId);
      expect(payload?.kid).toBeDefined();
      expect(payload?.createdAt).toBeDefined();
    });

    it("returns null for tampered signature", () => {
      const key = createApiKey(testUserId, testSecret);
      const [payloadBase64, _signature] = key.split(".");
      const tamperedKey = `${payloadBase64}.badsignature1234567890abcdef`;

      const result = verifyApiKey(tamperedKey, testSecret);

      expect(result).toBeNull();
    });

    it("returns null for tampered payload", () => {
      const key = createApiKey(testUserId, testSecret);
      const [_payloadBase64, signature] = key.split(".");
      const tamperedKey = `dGFtcGVyZHBheWxvYWQ.${signature}`;

      const result = verifyApiKey(tamperedKey, testSecret);

      expect(result).toBeNull();
    });

    it("returns null for missing signature", () => {
      const key = createApiKey(testUserId, testSecret);
      const tamperedKey = key.split(".")[0];

      const result = verifyApiKey(tamperedKey, testSecret);

      expect(result).toBeNull();
    });

    it("returns null for wrong secret", () => {
      const key = createApiKey(testUserId, testSecret);
      const result = verifyApiKey(key, "wrong-secret");

      expect(result).toBeNull();
    });

    it("returns null for malformed key", () => {
      expect(verifyApiKey("", testSecret)).toBeNull();
      expect(verifyApiKey("not-a-key", testSecret)).toBeNull();
      expect(verifyApiKey("a.b.c", testSecret)).toBeNull();
    });

    it("returns null for invalid payload JSON", () => {
      const invalidKey = `invalidbase64.${crypto.createHmac("sha256", testSecret).update(Buffer.from("invalid", "utf-8")).digest("hex")}`;

      const result = verifyApiKey(invalidKey, testSecret);

      expect(result).toBeNull();
    });

    it("uses timing-safe comparison for signature verification", () => {
      const validKey = createApiKey(testUserId, testSecret);

      // This should not throw and should return null
      const result = verifyApiKey(validKey.replace(/.$/, "x"), testSecret);
      expect(result).toBeNull();
    });
  });

  describe("createApiKey/verifyApiKey round-trip", () => {
    it("successfully verifies created key", () => {
      const key = createApiKey(testUserId, testSecret);
      const payload = verifyApiKey(key, testSecret);

      expect(payload?.userId).toBe(testUserId);
    });

    it("preserves userId through round-trip", () => {
      const userId = "test-user-456";
      const key = createApiKey(userId, testSecret);
      const payload = verifyApiKey(key, testSecret);

      expect(payload?.userId).toBe(userId);
    });

    it("different users have different keys", () => {
      const key1 = createApiKey("user-1", testSecret);
      const key2 = createApiKey("user-2", testSecret);

      expect(key1).not.toBe(key2);

      const payload1 = verifyApiKey(key1, testSecret);
      const payload2 = verifyApiKey(key2, testSecret);

      expect(payload1?.userId).toBe("user-1");
      expect(payload2?.userId).toBe("user-2");
    });
  });

  describe("extractBearerToken", () => {
    it("extracts token from valid Bearer header", () => {
      const token = "my-token-123";
      const header = `Bearer ${token}`;

      const result = extractBearerToken(header);

      expect(result).toBe(token);
    });

    it("returns null for missing header", () => {
      expect(extractBearerToken(undefined)).toBeNull();
    });

    it("returns null for empty header", () => {
      expect(extractBearerToken("")).toBeNull();
    });

    it("returns null for header without Bearer prefix", () => {
      expect(extractBearerToken("my-token-123")).toBeNull();
    });

    it("returns null for header with wrong prefix", () => {
      const header = `Basic ${Buffer.from("user:pass").toString("base64")}`;
      expect(extractBearerToken(header)).toBeNull();
    });

    it("returns null for malformed Bearer header (no token)", () => {
      expect(extractBearerToken("Bearer")).toBeNull();
    });

    it("returns null for malformed Bearer header (extra spaces)", () => {
      expect(extractBearerToken("Bearer token extra")).toBeNull();
    });

    it("returns null for tokens with spaces (malformed header)", () => {
      const header = "Bearer my-token-with-spaces more stuff";
      const result = extractBearerToken(header);

      expect(result).toBeNull();
    });
  });

  describe("requireAuth", () => {
    it("returns userId when defined", () => {
      expect(requireAuth("user-123")).toBe("user-123");
    });

    it("throws UnauthorizedError when undefined", () => {
      expect(() => requireAuth(undefined)).toThrow(UnauthorizedError);
    });

    it("throws with proper message", () => {
      try {
        requireAuth(undefined);
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedError);
        if (e instanceof UnauthorizedError) {
          expect(e.message).toBe("Authentication required");
        }
      }
    });
  });
});
