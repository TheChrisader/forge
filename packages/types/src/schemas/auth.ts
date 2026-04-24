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
  refreshToken: z.string(),
  expiresIn: z.string(),
  tokenType: z.literal("Bearer"),
});

export const RefreshTokenRequestSchema = z
  .object({
    refreshToken: z.string().min(1),
  })
  .strict();

export const RefreshTokenResponseSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.string(),
  tokenType: z.literal("Bearer"),
});

export const RegisterRequestSchema = z
  .object({
    email: z.email(),
    password: z.string().min(12, "Password must be at least 12 characters"),
    name: z.string().min(1).max(255).optional(),
  })
  .strict();

export const RegisterResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
});

export const ForgotPasswordRequestSchema = z
  .object({
    email: z.email(),
  })
  .strict();

export const ResetPasswordRequestSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(12, "Password must be at least 12 characters"),
  })
  .strict();

export const ChangePasswordRequestSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(12, "Password must be at least 12 characters"),
  })
  .strict();

export const UpdateProfileRequestSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    email: z.email().optional(),
  })
  .strict()
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export const AcceptInviteRequestSchema = z
  .object({
    token: z.string().min(1),
    password: z.string().min(12, "Password must be at least 12 characters"),
    name: z.string().min(1).max(255).optional(),
  })
  .strict();

export const AcceptInviteResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  teamId: z.string(),
  teamName: z.string(),
  role: z.string(),
});

export const ApiKeyResponseSchema = z.object({
  key: z.string(),
  id: z.string(),
  name: z.string(),
  prefix: z.string(),
  scopes: z.array(z.string()),
  expiresAt: z.string().nullable().optional(),
  createdAt: z.string(),
});

export const AuthMeResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.enum(["admin", "user"]),
  authenticatedVia: z.enum(["jwt", "api_key"]),
  teams: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      slug: z.string(),
      role: z.string(),
    })
  ),
  currentTeamId: z.string().nullable(),
  permissions: z.array(z.string()),
});

// =============================================================================
// Team & Invitation Schemas
// =============================================================================

export const CreateInvitationRequestSchema = z
  .object({
    email: z.email(),
    role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]).default("MEMBER"),
  })
  .strict();

export const InvitationResponseSchema = z.object({
  id: z.string(),
  email: z.string(),
  teamId: z.string(),
  role: z.string(),
  invitedBy: z.string(),
  expiresAt: z.string(),
  createdAt: z.string(),
});

export const UpdateMemberRoleRequestSchema = z
  .object({
    role: z.enum(["OWNER", "ADMIN", "MEMBER", "VIEWER"]),
  })
  .strict();

export const MemberResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  name: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  role: z.string(),
  joinedAt: z.string(),
});

export const TeamResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  memberCount: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
