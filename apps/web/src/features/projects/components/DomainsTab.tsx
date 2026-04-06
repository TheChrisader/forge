import { JSX, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  PlusIcon,
  TrashIcon,
  CheckCircleIcon,
  XCircleIcon,
  ShieldCheckIcon,
  ClockIcon,
} from "lucide-react";
import {
  useDomains,
  useAddDomain,
  useRemoveDomain,
  useVerifyDomain,
} from "@/core/api/hooks/useDomains";
import type { Project } from "@forge/types";

interface DomainsTabProps {
  project: Project;
}

export function DomainsTab({ project }: DomainsTabProps): JSX.Element {
  const { data: domains = [], isLoading } = useDomains(project.id);
  const addMutation = useAddDomain();
  const removeMutation = useRemoveDomain();
  const verifyMutation = useVerifyDomain();

  const [newDomain, setNewDomain] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [dnsInstructions, setDnsInstructions] = useState<{
    name: string;
    value: string;
  } | null>(null);

  const handleAddDomain = async (): Promise<void> => {
    if (!newDomain.trim()) return;

    setError(null);
    setDnsInstructions(null);

    try {
      const result = await addMutation.mutateAsync({
        projectId: project.id,
        data: { domain: newDomain.trim() },
      });

      setDnsInstructions({
        name: result.dnsInstructions.name,
        value: result.dnsInstructions.value,
      });
      setNewDomain("");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add domain";
      setError(message);
    }
  };

  const handleRemove = async (domainId: string): Promise<void> => {
    try {
      await removeMutation.mutateAsync({ projectId: project.id, domainId });
    } catch {
      // Error handled by mutation
    }
  };

  const handleVerify = async (domainId: string): Promise<void> => {
    try {
      await verifyMutation.mutateAsync({ projectId: project.id, domainId });
    } catch {
      // Error handled by mutation
    }
  };

  const autoSubdomain = `${project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-")}.localhost`;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-serif text-sm text-white/60 mb-3">Auto-Generated Domain</h3>
        <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/2 px-3 py-2">
          <GlobeIcon className="h-4 w-4 text-white/40" />
          <span className="font-mono text-sm text-white/70">{autoSubdomain}</span>
          <span className="ml-auto text-xs font-mono text-green-400 flex items-center gap-1">
            <CheckCircleIcon className="h-3 w-3" />
            Active
          </span>
        </div>
      </div>

      <div>
        <h3 className="font-serif text-sm text-white/60 mb-3">Custom Domains</h3>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-white/5 rounded-lg" />
            ))}
          </div>
        ) : domains.length === 0 ? (
          <div className="text-center py-8 text-white/30 font-mono text-sm">
            No custom domains configured
          </div>
        ) : (
          <div className="space-y-2">
            {domains.map((domain) => (
              <div
                key={domain.id}
                className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/2 px-3 py-2"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm text-white/80 truncate">{domain.domain}</div>
                  <div className="flex items-center gap-3 mt-1">
                    <SslStatusBadge status={domain.sslStatus} />
                    {domain.verified ? (
                      <span className="text-xs font-mono text-green-400 flex items-center gap-1">
                        <CheckCircleIcon className="h-3 w-3" />
                        Verified
                      </span>
                    ) : (
                      <span className="text-xs font-mono text-yellow-400 flex items-center gap-1">
                        <ClockIcon className="h-3 w-3" />
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  {!domain.verified && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleVerify(domain.id)}
                      disabled={verifyMutation.isPending}
                      className="text-xs font-mono"
                    >
                      Verify
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void handleRemove(domain.id)}
                    disabled={removeMutation.isPending}
                    className="text-red-400 hover:text-red-300"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-white/10 pt-4">
        <h3 className="font-serif text-sm text-white/60 mb-3">Add Custom Domain</h3>

        {error && (
          <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
            <p className="text-xs font-mono text-red-400">{error}</p>
          </div>
        )}

        {dnsInstructions && (
          <div className="mb-3 rounded-lg border border-blue-500/20 bg-blue-500/5 px-3 py-2">
            <p className="text-xs font-mono text-white/60 mb-1">DNS Configuration Required:</p>
            <p className="text-xs font-mono text-blue-300">
              CNAME {dnsInstructions.name} → {dnsInstructions.value}
            </p>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Input
            placeholder="example.com"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void handleAddDomain()}
            className="font-mono text-sm"
          />
          <Button
            onClick={void handleAddDomain}
            disabled={!newDomain.trim() || addMutation.isPending}
            size="sm"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

function SslStatusBadge({
  status,
}: {
  status: "PENDING" | "ACTIVE" | "EXPIRED" | "FAILED";
}): JSX.Element {
  switch (status) {
    case "ACTIVE":
      return (
        <span className="text-xs font-mono text-green-400 flex items-center gap-1">
          <ShieldCheckIcon className="h-3 w-3" />
          SSL Active
        </span>
      );
    case "PENDING":
      return (
        <span className="text-xs font-mono text-yellow-400 flex items-center gap-1">
          <ClockIcon className="h-3 w-3" />
          SSL Pending
        </span>
      );
    case "EXPIRED":
      return (
        <span className="text-xs font-mono text-orange-400 flex items-center gap-1">
          <XCircleIcon className="h-3 w-3" />
          SSL Expired
        </span>
      );
    case "FAILED":
      return (
        <span className="text-xs font-mono text-red-400 flex items-center gap-1">
          <XCircleIcon className="h-3 w-3" />
          SSL Failed
        </span>
      );
  }
}

function GlobeIcon({ className }: { className?: string }): JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
