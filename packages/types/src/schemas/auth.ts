import { z } from "zod";

// =============================================================================
// Authentication Schemas
// =============================================================================

export const LoginRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1),
  })
  .strict();

export const LoginResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.string(),
  tokenType: z.literal("Bearer"),
});

export const ApiKeyResponseSchema = z.object({
  key: z.string(),
  createdAt: z.number().int().nonnegative(),
  kid: z.string(),
});

export const AuthMeResponseSchema = z.object({
  userId: z.string(),
  role: z.enum(["admin", "user"]),
  authenticatedVia: z.enum(["jwt", "api_key"]),
});
