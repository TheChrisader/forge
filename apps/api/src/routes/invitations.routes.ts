import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import * as argon2 from "argon2";
import crypto from "node:crypto";
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from "@forge/core";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import {
  RegisterRequestSchema,
  RegisterResponseSchema,
  AcceptInviteRequestSchema,
  AcceptInviteResponseSchema,
  CreateInvitationRequestSchema,
  InvitationResponseSchema,
} from "@forge/types";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";

const ARGON2_HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
} as const satisfies argon2.Options;

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function registerInvitationRoutes(_server: FastifyInstance, config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const db = server.db;

  /**
   * POST /api/auth/register -- Register a new user
   */
  server.post(
    "/api/auth/register",
    {
      schema: {
        body: RegisterRequestSchema,
        response: { 200: RegisterResponseSchema },
      },
    },
    async (request) => {
      if (!config.security.registration?.enabled) {
        throw new ForbiddenError("Self-registration is not enabled");
      }

      const body = request.body as { email: string; password: string; name?: string };

      const existing = await db.user.findUnique({ where: { email: body.email } });
      if (existing) {
        throw new ConflictError("An account with this email already exists");
      }

      const passwordHash = await argon2.hash(body.password, ARGON2_HASH_OPTIONS);

      const user = await db.user.create({
        data: {
          email: body.email,
          name: body.name ?? null,
          passwordHash,
          status: "PENDING_INVITE",
        },
      });

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
      };
    }
  );

  /**
   * POST /api/auth/accept-invite -- Accept an invitation
   */
  server.post(
    "/api/auth/accept-invite",
    {
      schema: {
        body: AcceptInviteRequestSchema,
        response: { 200: AcceptInviteResponseSchema },
      },
    },
    async (request) => {
      const body = request.body as { token: string; password: string; name?: string };

      const tokenHash = hashToken(body.token);

      const invitation = await db.invitation.findUnique({
        where: { tokenHash },
        include: { team: true },
      });

      if (!invitation) {
        throw new NotFoundError("Invitation not found");
      }

      if (invitation.revokedAt) {
        throw new BadRequestError("This invitation has been revoked");
      }

      if (invitation.acceptedAt) {
        throw new BadRequestError("This invitation has already been accepted");
      }

      if (invitation.expiresAt < new Date()) {
        throw new BadRequestError("This invitation has expired");
      }

      const passwordHash = await argon2.hash(body.password, ARGON2_HASH_OPTIONS);

      let user = await db.user.findUnique({ where: { email: invitation.email } });

      if (!user) {
        user = await db.user.create({
          data: {
            email: invitation.email,
            name: body.name ?? null,
            passwordHash,
            status: "ACTIVE",
          },
        });
      } else {
        await db.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            status: "ACTIVE",
            ...(body.name ? { name: body.name } : {}),
          },
        });
      }

      try {
        await db.teamMember.create({
          data: {
            userId: user.id,
            teamId: invitation.teamId,
            role: invitation.role,
          },
        });
      } catch {
        // skip silently if the membership already exists
      }

      await db.invitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      return {
        userId: user.id,
        email: user.email,
        teamId: invitation.teamId,
        teamName: invitation.team.name,
        role: invitation.role,
      };
    }
  );

  /**
   * POST /api/teams/:teamId/invitations -- Create an invitation
   */
  server.post(
    "/api/teams/:teamId/invitations",
    {
      schema: {
        body: CreateInvitationRequestSchema,
        response: { 201: InvitationResponseSchema },
      },
    },
    async (request) => {
      const userId = requireAuth(request.userId);
      await requirePermission(request, { resource: "teams", action: "invite" });

      const { teamId } = request.params as { teamId: string };
      const body = request.body as { email: string; role: string };

      const team = await db.team.findUnique({ where: { id: teamId } });
      if (!team) {
        throw new NotFoundError("Team not found");
      }

      const existingInvitation = await db.invitation.findFirst({
        where: {
          teamId,
          email: body.email,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvitation) {
        throw new ConflictError("A pending invitation already exists for this email on this team");
      }

      const rawToken = crypto.randomUUID();
      const tokenHash = hashToken(rawToken);

      const invitation = await db.invitation.create({
        data: {
          teamId,
          email: body.email,
          role: body.role as "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
          tokenHash,
          invitedBy: userId,
          expiresAt: new Date(Date.now() + INVITATION_EXPIRY_MS),
        },
      });

      return {
        id: invitation.id,
        email: invitation.email,
        teamId: invitation.teamId,
        role: invitation.role,
        invitedBy: invitation.invitedBy,
        expiresAt: invitation.expiresAt.toISOString(),
        createdAt: invitation.createdAt.toISOString(),
      };
    }
  );

  /**
   * GET /api/teams/:teamId/invitations -- List pending invitations
   */
  server.get(
    "/api/teams/:teamId/invitations",
    {
      schema: {
        response: { 200: InvitationResponseSchema.array() },
      },
    },
    async (request) => {
      requireAuth(request.userId);
      await requirePermission(request, { resource: "teams", action: "invite" });

      const { teamId } = request.params as { teamId: string };

      const team = await db.team.findUnique({ where: { id: teamId } });
      if (!team) {
        throw new NotFoundError("Team not found");
      }

      const invitations = await db.invitation.findMany({
        where: {
          teamId,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      return invitations.map((inv) => ({
        id: inv.id,
        email: inv.email,
        teamId: inv.teamId,
        role: inv.role,
        invitedBy: inv.invitedBy,
        expiresAt: inv.expiresAt.toISOString(),
        createdAt: inv.createdAt.toISOString(),
      }));
    }
  );

  /**
   * DELETE /api/teams/:teamId/invitations/:id -- Revoke an invitation
   */
  server.delete(
    "/api/teams/:teamId/invitations/:id",
    {
      schema: {
        response: { 200: InvitationResponseSchema },
      },
    },
    async (request) => {
      requireAuth(request.userId);
      await requirePermission(request, { resource: "teams", action: "invite" });

      const { teamId, id } = request.params as { teamId: string; id: string };

      const invitation = await db.invitation.findUnique({
        where: { id },
      });

      if (!invitation || invitation.teamId !== teamId) {
        throw new NotFoundError("Invitation not found");
      }

      if (invitation.revokedAt) {
        throw new BadRequestError("Invitation has already been revoked");
      }

      if (invitation.acceptedAt) {
        throw new BadRequestError("Invitation has already been accepted");
      }

      const revoked = await db.invitation.update({
        where: { id: invitation.id },
        data: { revokedAt: new Date() },
      });

      return {
        id: revoked.id,
        email: revoked.email,
        teamId: revoked.teamId,
        role: revoked.role,
        invitedBy: revoked.invitedBy,
        expiresAt: revoked.expiresAt.toISOString(),
        createdAt: revoked.createdAt.toISOString(),
      };
    }
  );
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf-8").digest("hex");
}
