import type { PrismaClient } from "@forge/database";
import crypto from "node:crypto";
import { ConflictError, NotFoundError, BadRequestError, ForbiddenError } from "@forge/core";

export class InvitationService {
  private db: PrismaClient;

  constructor(db: PrismaClient) {
    this.db = db;
  }

  async create(
    teamId: string,
    invitedBy: string,
    email: string,
    role: string
  ): Promise<{
    id: string;
    token: string;
    email: string;
    teamId: string;
    role: string;
    expiresAt: Date;
  }> {
    const existingUser = await this.db.user.findUnique({ where: { email } });
    if (existingUser) {
      const existingMembership = await this.db.teamMember.findUnique({
        where: { teamId_userId: { userId: existingUser.id, teamId } },
      });
      if (existingMembership) {
        throw new ConflictError("User is already a member of this team");
      }
    }

    const pendingInvitation = await this.db.invitation.findFirst({
      where: {
        email,
        teamId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (pendingInvitation) {
      throw new ConflictError("An invitation for this email already exists");
    }

    const rawToken = crypto.randomUUID();
    const tokenHash = hashToken(rawToken);

    const invitation = await this.db.invitation.create({
      data: {
        email,
        teamId,
        role: role as "OWNER" | "ADMIN" | "MEMBER" | "VIEWER",
        tokenHash,
        invitedBy,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      include: { team: true },
    });

    return {
      id: invitation.id,
      token: rawToken,
      email: invitation.email,
      teamId: invitation.teamId,
      role: invitation.role,
      expiresAt: invitation.expiresAt,
    };
  }

  async accept(
    token: string,
    password: string,
    name: string | null,
    passwordHasher: (password: string) => Promise<string>
  ): Promise<{
    userId: string;
    email: string;
    teamId: string;
    teamName: string;
    role: string;
  }> {
    const tokenHash = hashToken(token);

    const invitation = await this.db.invitation.findFirst({
      where: {
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
      },
      include: { team: true },
    });

    if (!invitation) {
      throw new NotFoundError("Invitation");
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestError("Invitation has expired");
    }

    let user = await this.db.user.findUnique({ where: { email: invitation.email } });

    if (!user) {
      const hash = await passwordHasher(password);
      user = await this.db.user.create({
        data: {
          email: invitation.email,
          name: name ?? invitation.email.split("@")[0],
          passwordHash: hash,
          status: "ACTIVE",
        },
      });
    } else if (!user.passwordHash) {
      const hash = await passwordHasher(password);
      user = await this.db.user.update({
        where: { id: user.id },
        data: { passwordHash: hash },
      });
    }

    await this.db.teamMember
      .create({
        data: {
          teamId: invitation.teamId,
          userId: user.id,
          role: invitation.role,
        },
      })
      .catch(() => {
        // Already a member
      });

    await this.db.invitation.update({
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

  async revoke(invitationId: string, revokedBy: string): Promise<void> {
    const invitation = await this.db.invitation.findUnique({
      where: { id: invitationId },
    });

    if (!invitation) {
      throw new NotFoundError("Invitation");
    }

    if (invitation.revokedAt || invitation.acceptedAt) {
      throw new BadRequestError("Invitation is no longer active");
    }

    if (invitation.invitedBy !== revokedBy) {
      const membership = await this.db.teamMember.findUnique({
        where: { teamId_userId: { userId: revokedBy, teamId: invitation.teamId } },
      });

      if (!membership || (membership.role !== "OWNER" && membership.role !== "ADMIN")) {
        throw new ForbiddenError(
          "Only the inviter or a team admin/owner can revoke this invitation"
        );
      }
    }

    await this.db.invitation.update({
      where: { id: invitationId },
      data: { revokedAt: new Date() },
    });
  }

  async listForTeam(teamId: string): Promise<
    Array<{
      id: string;
      email: string;
      role: string;
      invitedBy: string;
      expiresAt: Date;
      createdAt: Date;
    }>
  > {
    const invitations = await this.db.invitation.findMany({
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
      role: inv.role,
      invitedBy: inv.invitedBy,
      expiresAt: inv.expiresAt,
      createdAt: inv.createdAt,
    }));
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf-8").digest("hex");
}
