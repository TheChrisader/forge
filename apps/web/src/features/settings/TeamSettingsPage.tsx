import { useState, useEffect } from "react";
import { useAuth } from "@/core/auth/AuthContext";
import { usePermissions } from "@/core/auth/usePermission";
import { apiClient } from "@/core/api/client";
import { Spinner } from "@/shared/components/ui/spinner";
import { Users, Mail, MoreHorizontal, Trash2, UserPlus } from "lucide-react";

interface Member {
  userId: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  invitedBy: string;
  expiresAt: string;
  createdAt: string;
}

export function TeamSettingsPage(): React.ReactElement {
  const { user, currentTeam } = useAuth();
  const { can } = usePermissions();

  const [activeTab, setActiveTab] = useState<"members" | "invitations">("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviting, setInviting] = useState(false);

  const canManageMembers = can("teams", "manage_members") || can("teams", "invite");

  const loadMembers = async (): Promise<void> => {
    if (!currentTeam) return;
    try {
      const data = await apiClient.get<Member[]>(`/api/teams/${currentTeam.id}/members`);
      setMembers(data);
    } catch {
      // TODO: Handle teams endpoint
    }
  };

  const loadInvitations = async (): Promise<void> => {
    if (!currentTeam) return;
    try {
      const data = await apiClient.get<Invitation[]>(`/api/teams/${currentTeam.id}/invitations`);
      setInvitations(data);
    } catch {
      // TODO: Handle invitations endpoint
    }
  };

  useEffect(() => {
    void (async (): Promise<void> => {
      setLoading(true);
      await Promise.all([loadMembers(), loadInvitations()]);
      setLoading(false);
    })();
  }, [currentTeam]);

  const handleInvite = async (): Promise<void> => {
    if (!currentTeam || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await apiClient.post(`/api/teams/${currentTeam.id}/invitations`, {
        email: inviteEmail,
        role: inviteRole,
      });
      setInviteEmail("");
      await loadInvitations();
    } catch {
      // Error handled by API client
    } finally {
      setInviting(false);
    }
  };

  const handleRevokeInvitation = async (id: string): Promise<void> => {
    if (!currentTeam) return;
    try {
      await apiClient.delete(`/api/teams/${currentTeam.id}/invitations/${id}`);
      await loadInvitations();
    } catch {
      // Error handled by API client
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-serif text-2xl font-bold tracking-tight">
          {currentTeam?.name ?? "Team"}
        </h2>
        <p className="font-sans text-sm text-muted-foreground mt-1">
          Manage team members, roles, and invitations
        </p>
      </div>

      <div className="flex gap-6 border-b border-border">
        {(["members", "invitations"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`font-sans text-sm pb-3 tracking-wide transition-colors ${
              activeTab === tab
                ? "border-b-2 border-primary text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
            <span className="ml-2 font-mono text-[10px] text-muted-foreground/60">
              {tab === "members" ? members.length : invitations.length}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "members" && (
        <div className="space-y-4">
          <div className="grid grid-cols-[1fr_100px_120px_80px] gap-4 px-4 py-2 font-mono text-[9px] tracking-widest text-muted-foreground/60 uppercase">
            <span>Member</span>
            <span>Role</span>
            <span>Joined</span>
            <span />
          </div>

          {members.map((member) => (
            <div
              key={member.userId}
              className="grid grid-cols-[1fr_100px_120px_80px] gap-4 items-center rounded-sm border border-border/30 px-4 py-3 hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-muted font-serif text-sm font-semibold">
                  {(member.name ?? member.email).charAt(0).toUpperCase()}
                </div>
                <div className="flex flex-col">
                  <span className="font-sans text-sm font-medium">
                    {member.name ?? member.email}
                  </span>
                  {member.name && (
                    <span className="font-mono text-[9px] text-muted-foreground/60">
                      {member.email}
                    </span>
                  )}
                </div>
              </div>

              <span className="font-mono text-[10px] tracking-wider uppercase text-muted-foreground/80">
                {member.role}
              </span>

              <span className="font-mono text-[10px] text-muted-foreground/60">
                {new Date(member.joinedAt).toLocaleDateString()}
              </span>

              {canManageMembers && member.userId !== user?.userId && (
                <button className="text-muted-foreground/40 hover:text-destructive transition-colors">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}

          {members.length === 0 && (
            <div className="py-12 text-center">
              <Users className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="font-sans text-sm text-muted-foreground mt-2">No members yet</p>
            </div>
          )}
        </div>
      )}

      {activeTab === "invitations" && (
        <div className="space-y-4">
          {canManageMembers && (
            <div className="flex items-end gap-3 rounded-sm border border-border/30 p-4">
              <div className="flex-1">
                <label className="font-mono text-[9px] tracking-widest text-muted-foreground/60 uppercase block mb-1.5">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="font-sans w-full border border-border/30 bg-background px-3 py-2 text-sm tracking-wide focus:border-primary focus:outline-none"
                />
              </div>
              <div className="w-32">
                <label className="font-mono text-[9px] tracking-widest text-muted-foreground/60 uppercase block mb-1.5">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="font-sans w-full border border-border/30 bg-background px-3 py-2 text-sm tracking-wide focus:border-primary focus:outline-none"
                >
                  <option value="MEMBER">Member</option>
                  <option value="VIEWER">Viewer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              <button
                onClick={() => void handleInvite()}
                disabled={!inviteEmail.trim() || inviting}
                className="flex items-center gap-2 rounded-sm bg-primary px-4 py-2 font-sans text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus className="h-4 w-4" />
                {inviting ? "Sending..." : "Invite"}
              </button>
            </div>
          )}

          {invitations.map((inv) => (
            <div
              key={inv.id}
              className="flex items-center justify-between rounded-sm border border-border/30 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground/50" />
                <div className="flex flex-col">
                  <span className="font-sans text-sm">{inv.email}</span>
                  <span className="font-mono text-[9px] text-muted-foreground/60">
                    {inv.role} — expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => void handleRevokeInvitation(inv.id)}
                className="text-muted-foreground/40 hover:text-destructive transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}

          {invitations.length === 0 && (
            <div className="py-12 text-center">
              <Mail className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="font-sans text-sm text-muted-foreground mt-2">No pending invitations</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
