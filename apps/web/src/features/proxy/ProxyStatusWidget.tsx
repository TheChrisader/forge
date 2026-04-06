import { JSX } from "react";
import { ShieldCheckIcon, ShieldAlertIcon, GlobeIcon, ClockIcon } from "lucide-react";
import { useProxyStatus } from "@/core/api/hooks/useDomains";

function formatUptime(ms: number): string {
  if (ms < 0) return "Unknown";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m`;
}

export function ProxyStatusWidget(): JSX.Element {
  const { data: status, isLoading, error } = useProxyStatus();

  if (isLoading) {
    return (
      <div className="rounded-lg border border-white/10 bg-white/2 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-5 w-5 animate-pulse bg-white/10 rounded" />
          <div className="h-4 w-32 animate-pulse bg-white/10 rounded" />
        </div>
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse bg-white/5 rounded" />
          <div className="h-3 w-3/4 animate-pulse bg-white/5 rounded" />
        </div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-4">
        <div className="flex items-center gap-2 text-red-400 mb-2">
          <ShieldAlertIcon className="h-5 w-5" />
          <span className="font-mono text-sm">Proxy Unavailable</span>
        </div>
        <p className="text-xs text-white/40 font-mono">
          Unable to connect to the reverse proxy service.
        </p>
      </div>
    );
  }

  const isHealthy = status.healthy;

  return (
    <div
      className={`rounded-lg border p-4 ${
        isHealthy ? "border-green-500/20 bg-green-500/5" : "border-red-500/20 bg-red-500/5"
      }`}
    >
      <div
        className={`flex items-center gap-2 mb-3 ${isHealthy ? "text-green-400" : "text-red-400"}`}
      >
        {isHealthy ? (
          <ShieldCheckIcon className="h-5 w-5" />
        ) : (
          <ShieldAlertIcon className="h-5 w-5" />
        )}
        <span className="font-mono text-sm">{isHealthy ? "Proxy Healthy" : "Proxy Unhealthy"}</span>
      </div>

      <div className="grid grid-cols-3 gap-4 text-xs font-mono">
        <div>
          <div className="text-white/40 mb-1">Provider</div>
          <div className="text-white/70 capitalize">{status.provider}</div>
        </div>
        <div>
          <div className="text-white/40 mb-1 flex items-center gap-1">
            <GlobeIcon className="h-3 w-3" />
            Routes
          </div>
          <div className="text-white/70">{status.routes}</div>
        </div>
        <div>
          <div className="text-white/40 mb-1 flex items-center gap-1">
            <ClockIcon className="h-3 w-3" />
            Uptime
          </div>
          <div className="text-white/70">{formatUptime(status.uptime)}</div>
        </div>
      </div>

      {status.ssl.enabled && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="text-xs font-mono text-white/40 mb-1">SSL</div>
          <div className="text-xs font-mono text-white/70">
            {status.ssl.activeCerts} active certificate{status.ssl.activeCerts !== 1 ? "s" : ""}
          </div>
        </div>
      )}
    </div>
  );
}
