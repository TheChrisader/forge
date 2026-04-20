import { useCallback, useState } from "react";
import { useParams, Link } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import {
  ArrowLeftIcon,
  PlayIcon,
  SquareIcon,
  RotateCcwIcon,
  CopyIcon,
  LoaderIcon,
  AlertCircleIcon,
} from "lucide-react";
import {
  useService,
  useStartService,
  useStopService,
  useRestartService,
} from "@/core/api/hooks/useServices";
import { ServiceTypeIcon } from "./components/ServiceTypeIcon";
import { ServiceStatusBadge } from "./components/ServiceStatusBadge";
import { ServiceConnectionPanel } from "./components/ServiceConnectionPanel";
import { ServiceStatsCards } from "./components/ServiceStatsCards";
import { ServiceLogsViewer } from "./components/ServiceLogsViewer";
import { ServiceBackupPanel } from "./components/ServiceBackupPanel";
import { ServiceConfigPanel } from "./components/ServiceConfigPanel";
import { formatRelativeTime } from "@/features/dashboard/lib/format";
import type { ServiceStatus } from "@forge/types";

type Tab = "overview" | "backups" | "logs" | "settings";

const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "backups", label: "Backups" },
  { value: "logs", label: "Logs" },
  { value: "settings", label: "Settings" },
];

function isTransitional(status: ServiceStatus): boolean {
  return ["CREATING", "STARTING", "STOPPING", "UPGRADING", "BACKING_UP", "RESTORING"].includes(
    status
  );
}

export function ServiceDetailPage(): React.ReactElement {
  const { serviceId } = useParams({ from: "/authenticated/services/$serviceId" });
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const { data: serviceData, isLoading, isError } = useService(serviceId);

  const startMutation = useStartService();
  const stopMutation = useStopService();
  const restartMutation = useRestartService();

  const service = serviceData?.data;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <LoaderIcon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !service) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-32">
        <AlertCircleIcon className="h-8 w-8 text-destructive" />
        <p className="font-sans text-sm text-muted-foreground">Service not found</p>
        <Link to="/services">
          <Button variant="outline" size="sm">
            Back to Services
          </Button>
        </Link>
      </div>
    );
  }

  const status = service.status;

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-5">
        <div className="flex items-center gap-4">
          <Link to="/services">
            <Button variant="ghost" size="sm" className="group">
              <ArrowLeftIcon className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" />
            </Button>
          </Link>
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <ServiceTypeIcon type={service.type} className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="font-serif text-2xl font-bold tracking-tight">{service.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">
              {service.engine} {service.version ? `v${service.version}` : ""}
            </p>
          </div>
          <ServiceStatusBadge status={status} size="md" />
        </div>

        <div className="flex items-center gap-2">
          {(status === "RUNNING" || status === "HEALTHY") && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="group transition-all hover:shadow-md"
                onClick={() => setActiveTab("logs")}
              >
                Logs
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="group transition-all hover:shadow-md"
                onClick={() => void restartMutation.mutate(service.id)}
                disabled={restartMutation.isPending}
              >
                {restartMutation.isPending ? (
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <RotateCcwIcon className="h-3.5 w-3.5 mr-1.5 transition-transform group-hover:rotate-180 group-hover:scale-110" />
                )}
                Restart
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="group transition-all hover:shadow-md"
                onClick={() => void stopMutation.mutate(service.id)}
                disabled={stopMutation.isPending}
              >
                {stopMutation.isPending ? (
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <SquareIcon className="h-3.5 w-3.5 mr-1.5" />
                )}
                Stop
              </Button>
            </>
          )}
          {status === "STOPPED" && (
            <Button
              variant="outline"
              size="sm"
              className="group transition-all hover:shadow-md"
              onClick={() => void startMutation.mutate(service.id)}
              disabled={startMutation.isPending}
            >
              {startMutation.isPending ? (
                <LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <PlayIcon className="h-3.5 w-3.5 mr-1.5" />
              )}
              Start
            </Button>
          )}
          {isTransitional(status) && (
            <Button variant="outline" size="sm" disabled>
              <LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" />
              {status}
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 border-b border-border/50 px-6">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-3 font-sans text-sm border-b-2 transition-colors ${
              activeTab === tab.value
                ? "border-primary text-foreground font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === "overview" && (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="space-y-6 lg:col-span-2">
              <ServiceConnectionPanel serviceId={service.id} serviceStatus={status} />
            </div>
            <div className="space-y-6">
              <ServiceStatsCards serviceId={service.id} serviceStatus={status} />

              <Card className="group transition-all hover:shadow-lg">
                <CardHeader>
                  <CardTitle className="font-serif text-base font-medium">Service Info</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <InfoField label="Engine" value={service.engine ?? "—"} />
                  <InfoField
                    label="Version"
                    value={service.version ? `v${service.version}` : "—"}
                  />
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Type
                    </span>
                    <Badge
                      variant="secondary"
                      className="font-mono text-[10px] uppercase tracking-wider"
                    >
                      {service.type}
                    </Badge>
                  </div>
                  {service.internalHostname && (
                    <CopyableField label="Hostname" value={service.internalHostname} />
                  )}
                  {service.containerId && (
                    <CopyableField label="Container ID" value={service.containerId} />
                  )}
                  {service.volumeName && <InfoField label="Volume" value={service.volumeName} />}
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Created
                    </span>
                    <span className="font-sans text-sm text-muted-foreground">
                      {formatRelativeTime(new Date(service.createdAt).toISOString())}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Project
                    </span>
                    <Link
                      to="/projects/$projectId"
                      params={{ projectId: service.projectId }}
                      className="font-sans text-sm text-primary hover:underline"
                    >
                      {service.projectId}
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === "backups" && (
          <ServiceBackupPanel
            serviceId={service.id}
            serviceStatus={status}
            autoBackupSchedule={service.autoBackupSchedule}
            autoBackupRetention={service.autoBackupRetention}
          />
        )}

        {activeTab === "logs" && <ServiceLogsViewer serviceId={service.id} />}

        {activeTab === "settings" && <ServiceConfigPanel service={service} />}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm">{value}</span>
    </div>
  );
}

function CopyableField({ label, value }: { label: string; value: string }): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [value]);

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs truncate max-w-45">{value}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 p-0.5 rounded hover:bg-muted transition-colors"
        >
          <CopyIcon
            className={`h-3 w-3 ${copied ? "text-success-500" : "text-muted-foreground"}`}
          />
        </button>
      </div>
    </div>
  );
}
