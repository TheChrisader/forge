import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { CopyIcon, EyeIcon, EyeOffIcon, LinkIcon, LoaderIcon } from "lucide-react";
import { servicesApi } from "@/core/api/clients/services";
import type { ServiceConnection } from "@/core/api/clients/services";
import type { ServiceStatus } from "@forge/types";

interface ServiceConnectionPanelProps {
  serviceId: string;
  serviceStatus: ServiceStatus;
}

function CopyButton({ value }: { value: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <Button variant="ghost" size="icon-xs" onClick={handleCopy} className="shrink-0">
      <CopyIcon className={`h-3 w-3 ${copied ? "text-success-500" : ""}`} />
    </Button>
  );
}

export function ServiceConnectionPanel({
  serviceId,
  serviceStatus,
}: ServiceConnectionPanelProps): React.ReactElement {
  const [connection, setConnection] = useState<ServiceConnection | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isRunning = serviceStatus === "RUNNING" || serviceStatus === "HEALTHY";

  const fetchConnection = useCallback(
    (reveal: boolean) => {
      setLoading(true);
      setError(null);
      servicesApi
        .getConnection(serviceId, reveal)
        .then((res) => {
          setConnection(res.data);
          setRevealed(reveal);
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load connection details");
        })
        .finally(() => setLoading(false));
    },
    [serviceId]
  );

  const handleReveal = useCallback(() => {
    fetchConnection(true);
  }, [fetchConnection]);

  const handleHide = useCallback(() => {
    fetchConnection(false);
  }, [fetchConnection]);

  if (!isRunning) {
    return (
      <Card className="group transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <LinkIcon className="h-4 w-4 text-primary" />
            </div>
            Connection Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-sans text-sm text-muted-foreground">
            Connection details will be available when the service is running.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="group transition-all hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-serif">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <LinkIcon className="h-4 w-4 text-primary" />
            </div>
            Connection Info
          </CardTitle>
          <div className="flex items-center gap-2">
            {connection && (
              <Button
                variant="outline"
                size="sm"
                onClick={revealed ? handleHide : handleReveal}
                disabled={loading}
              >
                {loading ? (
                  <LoaderIcon className="h-3 w-3 animate-spin mr-1.5" />
                ) : revealed ? (
                  <EyeOffIcon className="h-3 w-3 mr-1.5" />
                ) : (
                  <EyeIcon className="h-3 w-3 mr-1.5" />
                )}
                {revealed ? "Hide Credentials" : "Reveal Credentials"}
              </Button>
            )}
            {!connection && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchConnection(false)}
                disabled={loading}
              >
                {loading ? <LoaderIcon className="h-3 w-3 animate-spin mr-1.5" /> : null}
                Load
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {error && <p className="font-sans text-sm text-destructive">{error}</p>}
        {connection && (
          <div className="space-y-4">
            <ConnectionField
              label="Host"
              value={connection.host ?? "—"}
              copyable={!!connection.host}
            />
            <ConnectionField
              label="Port"
              value={connection.port?.toString() ?? "—"}
              copyable={!!connection.port}
            />
            <ConnectionField
              label="Username"
              value={connection.username ?? "—"}
              copyable={!!connection.username}
            />
            <ConnectionField
              label="Password"
              value={revealed ? (connection.password ?? "Not set") : "••••••••"}
              copyable={revealed && !!connection.password}
            />
            <ConnectionField
              label="Database"
              value={connection.database ?? "—"}
              copyable={!!connection.database}
            />

            {connection.url && (
              <div className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
                  URL
                </p>
                <p className="font-mono text-xs flex-1 truncate">
                  {revealed ? connection.url : connection.url.replace(/:[^:@]+@/, ":****@")}
                </p>
                <CopyButton value={revealed ? connection.url : connection.url} />
              </div>
            )}

            {revealed && connection.envVars && Object.keys(connection.envVars).length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Environment Variables
                  </p>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => {
                      const text = Object.entries(connection.envVars!)
                        .map(([k, v]) => `${k}=${v}`)
                        .join("\n");
                      void navigator.clipboard.writeText(text);
                    }}
                  >
                    <CopyIcon className="h-3 w-3" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(connection.envVars).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className="font-mono text-xs text-foreground">{key}</span>
                      <span className="font-mono text-xs text-muted-foreground">=</span>
                      <span className="font-mono text-xs text-muted-foreground truncate">
                        {value}
                      </span>
                      <CopyButton value={`${key}=${value}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {!connection && !error && !loading && (
          <p className="font-sans text-sm text-muted-foreground">
            Click "Load" to view connection details.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function ConnectionField({
  label,
  value,
  copyable,
}: {
  label: string;
  value: string;
  copyable: boolean;
}): React.ReactElement {
  return (
    <div className="flex items-center gap-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0 w-20">
        {label}
      </p>
      <p className="font-mono text-xs flex-1 truncate">{value}</p>
      {copyable && <CopyButton value={value} />}
    </div>
  );
}
