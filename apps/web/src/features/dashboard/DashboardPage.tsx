import { useDashboardStats } from "@/core/api/hooks/useDashboard";
import { useAuditLogs } from "@/core/api/hooks/useAuditLogs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { Separator } from "@/shared/components/ui/separator";
import {
  ActivityIcon,
  RocketIcon,
  ServerIcon,
  PlusIcon,
  SettingsIcon,
  CpuIcon,
  HardDriveIcon,
  ZapIcon,
  TrendingUpIcon,
  FolderIcon,
  RefreshCwIcon,
  LayersIcon,
  DatabaseIcon,
  ArchiveIcon,
  AlertCircleIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { formatAuditAction, formatRelativeTime, formatBytes } from "./lib/format";

const RESOURCE_ICONS: Record<string, LucideIcon> = {
  deployments: RocketIcon,
  containers: CpuIcon,
  projects: FolderIcon,
  services: ServerIcon,
  secrets: DatabaseIcon,
  domains: LayersIcon,
  images: ArchiveIcon,
};

function getResourceProgressColor(value: number): string {
  if (value >= 80) return "[&>div]:bg-destructive";
  if (value >= 60) return "[&>div]:bg-warning-500";
  return "[&>div]:bg-primary";
}

function getResourceLabel(value: number): string {
  if (value >= 80) return "High";
  if (value >= 60) return "Moderate";
  return "Normal";
}

const quickActions = [
  {
    title: "New Project",
    description: "Create a new project",
    icon: PlusIcon,
    href: "/projects",
    shortcut: "\u2318N",
  },
  {
    title: "View Activity",
    description: "Access audit log",
    icon: ActivityIcon,
    href: "/activity",
    shortcut: "\u2318L",
  },
  {
    title: "Settings",
    description: "Platform configuration",
    icon: SettingsIcon,
    href: "/settings",
    shortcut: "\u2318,",
  },
];

function StatCardSkeleton(): React.ReactElement {
  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-muted animate-pulse" />
            <div className="h-3 w-16 rounded bg-muted animate-pulse" />
          </div>
          <div className="h-5 w-12 rounded-md bg-muted animate-pulse" />
        </div>
        <div className="mt-2 h-8 w-20 rounded bg-muted animate-pulse" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <div className="h-1 w-full rounded-full bg-muted animate-pulse" />
          <div className="h-2 w-24 rounded bg-muted animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceRowSkeleton(): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-3.5 w-3.5 rounded bg-muted animate-pulse" />
          <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-3 w-8 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted animate-pulse" />
      <div className="flex items-center justify-between">
        <div className="h-2 w-24 rounded bg-muted animate-pulse" />
        <div className="h-2 w-12 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function DashboardPage(): React.ReactElement {
  const { data: dashboard, isLoading, error, refetch } = useDashboardStats();
  const { data: auditData } = useAuditLogs({ page: 1, limit: 5 });

  const stats = dashboard
    ? [
        {
          title: "Projects",
          value: dashboard.counts.projects,
          trend: dashboard.trends.projects,
          icon: FolderIcon,
        },
        {
          title: "Services",
          value: dashboard.counts.services,
          trend: null,
          icon: ServerIcon,
        },
        {
          title: "Deployments",
          value: dashboard.counts.deployments,
          trend: dashboard.trends.deployments,
          icon: RocketIcon,
        },
        {
          title: "Containers",
          value: dashboard.counts.containers,
          trend: dashboard.trends.containers,
          icon: CpuIcon,
        },
      ]
    : [];

  const cpuPercent = dashboard?.system.cpuPercent ?? 0;
  const memoryTotalBytes = dashboard?.system.memoryTotalBytes ?? 1;
  const memoryUsedBytes = dashboard?.system.memoryUsedBytes ?? 0;
  const memoryPercent =
    memoryTotalBytes > 0 ? Math.round((memoryUsedBytes / memoryTotalBytes) * 100) : 0;
  const storageTotalBytes = dashboard?.system.storage.totalSizeBytes ?? 0;

  const activityItems =
    auditData?.items.map((log) => ({
      id: log.id,
      resourceType: log.resourceType,
      project: log.projectId ?? "System",
      description: formatAuditAction(log.action),
      // @ts-expect-error -- TODO
      timestamp: formatRelativeTime(log.timestamp),
      userEmail: log.userEmail,
    })) ?? [];

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircleIcon className="h-4 w-4" />
            <span>Failed to load dashboard stats</span>
          </div>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 rounded-md px-3 py-1 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <RefreshCwIcon className="h-3 w-3" />
            Retry
          </button>
        </div>
      )}

      <div className="flex items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider">
            Quick Actions
          </span>
        </div>
        <div className="flex items-center gap-2">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.title} to={action.href}>
                <button className="group flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted/50">
                  <Icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
                  <span className="font-sans text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {action.title}
                  </span>
                  <kbd className="font-mono text-[9px] text-muted-foreground/50">
                    {action.shortcut}
                  </kbd>
                </button>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)
          : stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <Card
                  key={stat.title}
                  className="group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                          {stat.title}
                        </CardDescription>
                      </div>
                      {stat.trend !== null && stat.trend > 0 && (
                        <div className="flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase bg-success-500/10 text-success-500">
                          <TrendingUpIcon className="h-3 w-3" />
                          <span>+{stat.trend}</span>
                        </div>
                      )}
                    </div>
                    <CardTitle className="font-serif text-3xl font-bold tracking-tight">
                      {stat.value}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Progress
                        value={stat.trend !== null ? Math.min(stat.trend * 5, 100) : 0}
                        className="h-1"
                      />
                      <p className="font-mono text-[10px] text-muted-foreground uppercase">
                        {stat.trend !== null && stat.trend > 0
                          ? `+${stat.trend} this week`
                          : stat.title}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-serif">Resources</CardTitle>
            <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
              System Utilization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {isLoading ? (
              <>
                <ResourceRowSkeleton />
                <ResourceRowSkeleton />
                <ResourceRowSkeleton />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CpuIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-sans text-sm font-medium">CPU</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {Math.round(cpuPercent)}%
                    </span>
                  </div>
                  <Progress
                    value={cpuPercent}
                    className={`h-1.5 ${getResourceProgressColor(cpuPercent)}`}
                  />
                  <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                    <span>{dashboard?.system.cpuCores ?? 0} cores</span>
                    <span>{getResourceLabel(cpuPercent)}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ZapIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-sans text-sm font-medium">Memory</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {memoryPercent}%
                    </span>
                  </div>
                  <Progress
                    value={memoryPercent}
                    className={`h-1.5 ${getResourceProgressColor(memoryPercent)}`}
                  />
                  <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                    <span>
                      {formatBytes(memoryUsedBytes)} / {formatBytes(memoryTotalBytes)}
                    </span>
                    <span>{getResourceLabel(memoryPercent)}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <HardDriveIcon className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="font-sans text-sm font-medium">Storage (Docker)</span>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {formatBytes(storageTotalBytes)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 font-mono text-[9px] text-muted-foreground pt-1">
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground/60">Images</span>
                      <p>{formatBytes(dashboard?.system.storage.imagesSizeBytes ?? 0)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground/60">Containers</span>
                      <p>{formatBytes(dashboard?.system.storage.containersSizeBytes ?? 0)}</p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-muted-foreground/60">Volumes</span>
                      <p>{formatBytes(dashboard?.system.storage.volumesSizeBytes ?? 0)}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between rounded-md bg-muted/30 px-3 py-2">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase">
                    Containers
                  </span>
                  <span className="font-mono text-xs font-medium">
                    {dashboard?.system.containersRunning ?? 0} /{" "}
                    {dashboard?.system.containersTotal ?? 0}
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif">Activity Feed</CardTitle>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Latest Actions
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[9px]">
                {activityItems.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {activityItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <ActivityIcon className="h-8 w-8 mb-2 opacity-40" />
                <p className="font-sans text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-0">
                {activityItems.map((item, index) => {
                  const Icon = RESOURCE_ICONS[item.resourceType] ?? ActivityIcon;
                  const isCreate =
                    item.description.includes("created") || item.description.includes("deployed");

                  return (
                    <div key={item.id} className="group">
                      <div className="flex gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
                        <div className="flex flex-col items-center">
                          <div className="relative">
                            <div
                              className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 transition-transform group-hover:scale-125 ${
                                isCreate
                                  ? "bg-success-500 border-success-500"
                                  : item.description.includes("deleted")
                                    ? "bg-destructive border-destructive"
                                    : "bg-muted-foreground border-muted-foreground"
                              }`}
                            />
                          </div>
                          {index < activityItems.length - 1 && (
                            <div className="w-0.5 flex-1 mt-2 min-h-12 bg-border" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`flex h-8 w-8 items-center justify-center rounded-md ${
                                  isCreate
                                    ? "bg-success-500/10"
                                    : item.description.includes("deleted")
                                      ? "bg-destructive/10"
                                      : "bg-muted"
                                } transition-colors group-hover:scale-110`}
                              >
                                <Icon
                                  className={`h-4 w-4 ${
                                    isCreate
                                      ? "text-success-500"
                                      : item.description.includes("deleted")
                                        ? "text-destructive"
                                        : "text-muted-foreground"
                                  }`}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="font-sans text-sm font-medium">{item.description}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="font-mono text-xs text-muted-foreground">
                                    {item.project}
                                  </span>
                                  {item.userEmail && (
                                    <>
                                      <span className="text-muted-foreground/40">&middot;</span>
                                      <span className="font-mono text-[10px] text-muted-foreground/60">
                                        {item.userEmail}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                              <Badge
                                variant="outline"
                                className={`font-mono text-[9px] ${
                                  isCreate ? "text-success-500 border-success-500/20" : ""
                                }`}
                              >
                                {item.resourceType}
                              </Badge>
                              <span className="font-mono text-[9px] text-muted-foreground uppercase">
                                {item.timestamp}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      {index < activityItems.length - 1 && <Separator />}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
          {activityItems.length > 0 && (
            <div className="border-t border-border/50 px-6 py-3">
              <Link to="/activity">
                <button className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors">
                  View All Activity &rarr;
                </button>
              </Link>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
