import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import { Separator } from "@/shared/components/ui/separator";
import {
  ActivityIcon,
  RocketIcon,
  ServerIcon,
  PlusIcon,
  SettingsIcon,
  CpuIcon,
  HardDriveIcon,
  NetworkIcon,
  ZapIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  MinusIcon,
  FolderIcon,
} from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import type { ServiceStatus, DeploymentStatus } from "@forge/types";

// Mock data for stat cards
const stats = [
  {
    title: "Projects",
    value: "12",
    trend: "+2 this month",
    trendValue: 12,
    trendPositive: true,
    trendDirection: "up" as const,
    icon: FolderIcon,
  },
  {
    title: "Services",
    value: "24",
    trend: "+5 this week",
    trendValue: 8,
    trendPositive: true,
    trendDirection: "up" as const,
    icon: ServerIcon,
  },
  {
    title: "Deployments",
    value: "156",
    trend: "+18 today",
    trendValue: 18,
    trendPositive: true,
    trendDirection: "up" as const,
    icon: RocketIcon,
  },
  {
    title: "Containers",
    value: "48",
    trend: "-3 from peak",
    trendValue: 3,
    trendPositive: false,
    trendDirection: "down" as const,
    icon: CpuIcon,
  },
];

interface ActivityItem {
  id: string;
  type: "deployment" | "service";
  project: string;
  service: string;
  status: ServiceStatus | DeploymentStatus;
  description: string;
  timestamp: string;
}

const recentActivity: ActivityItem[] = [
  {
    id: "act-1",
    type: "deployment",
    project: "forge-web",
    service: "web-app",
    status: "SUCCEEDED" as DeploymentStatus,
    description: "Deployment completed successfully",
    timestamp: "2 minutes ago",
  },
  {
    id: "act-2",
    type: "service",
    project: "forge-api",
    service: "auth-service",
    status: "HEALTHY" as ServiceStatus,
    description: "Service restarted automatically",
    timestamp: "15 minutes ago",
  },
  {
    id: "act-3",
    type: "deployment",
    project: "forge-worker",
    service: "background-jobs",
    status: "FAILED" as DeploymentStatus,
    description: "Deployment failed, rolling back",
    timestamp: "1 hour ago",
  },
  {
    id: "act-4",
    type: "service",
    project: "forge-web",
    service: "admin-dashboard",
    status: "RUNNING" as ServiceStatus,
    description: "New service created",
    timestamp: "3 hours ago",
  },
  {
    id: "act-5",
    type: "deployment",
    project: "forge-api",
    service: "api-gateway",
    status: "BUILDING" as DeploymentStatus,
    description: "Deployment in progress",
    timestamp: "Just now",
  },
];

const quickActions = [
  {
    title: "New Project",
    description: "Create a new project",
    icon: PlusIcon,
    href: "/projects",
    shortcut: "⌘N",
  },
  {
    title: "View Logs",
    description: "Access system logs",
    icon: ActivityIcon,
    href: "/logs",
    shortcut: "⌘L",
  },
  {
    title: "Settings",
    description: "Platform configuration",
    icon: SettingsIcon,
    href: "/settings",
    shortcut: "⌘,",
  },
];

const icons: Record<string, LucideIcon> = {
  deployment: RocketIcon,
  service: ServerIcon,
};

// Trend icon component
function TrendIcon({ direction }: { direction: "up" | "down" | "neutral" }): React.ReactElement {
  switch (direction) {
    case "up":
      return <TrendingUpIcon className="h-3 w-3" />;
    case "down":
      return <TrendingDownIcon className="h-3 w-3" />;
    default:
      return <MinusIcon className="h-3 w-3" />;
  }
}

// Resource color based on usage
function getResourceColor(value: number): string {
  if (value >= 80) return "bg-destructive";
  if (value >= 60) return "bg-warning-500";
  return "bg-primary";
}

function getResourceProgressColor(value: number): string {
  if (value >= 80) return "[&>div]:bg-destructive";
  if (value >= 60) return "[&>div]:bg-warning-500";
  return "[&>div]:bg-primary";
}

export function DashboardPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Quick Actions - subtle bar */}
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

      {/* Stats Grid with asymmetric layout */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <Card
              key={stat.title}
              className={`group relative overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 ${
                index === 0 ? "sm:col-span-2 lg:col-span-1" : ""
              }`}
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
                  <div
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 font-mono text-[9px] uppercase ${
                      stat.trendPositive
                        ? "bg-success-500/10 text-success-500"
                        : "bg-destructive/10 text-destructive"
                    }`}
                  >
                    <TrendIcon direction={stat.trendDirection} />
                    <span>{stat.trend.split(" ")[0]}</span>
                  </div>
                </div>
                <CardTitle className="font-serif text-3xl font-bold tracking-tight">
                  {stat.value}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Progress value={stat.trendValue} className="h-1" />
                  <p className="font-mono text-[10px] text-muted-foreground uppercase">
                    {stat.trend}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Two column layout: Resources + Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Resource Utilization - takes 1 column */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="font-serif">Resources</CardTitle>
            <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
              Cluster Utilization
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* CPU */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CpuIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-sans text-sm font-medium">CPU</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">68%</span>
              </div>
              <Progress value={68} className={`h-1.5 ${getResourceProgressColor(68)}`} />
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                <span>4.2 / 6 cores</span>
                <span
                  className={getResourceColor(68) === "bg-destructive" ? "text-destructive" : ""}
                >
                  {getResourceColor(68) === "bg-destructive" ? "High load" : "Normal"}
                </span>
              </div>
            </div>

            {/* Memory */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ZapIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-sans text-sm font-medium">Memory</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">51%</span>
              </div>
              <Progress value={51} className={`h-1.5 ${getResourceProgressColor(51)}`} />
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                <span>8.2 / 16 GB</span>
                <span>Normal</span>
              </div>
            </div>

            {/* Storage */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HardDriveIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-sans text-sm font-medium">Storage</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">47%</span>
              </div>
              <Progress value={47} className={`h-1.5 ${getResourceProgressColor(47)}`} />
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                <span>234 / 500 GB</span>
                <span>Normal</span>
              </div>
            </div>

            {/* Network */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <NetworkIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-sans text-sm font-medium">Network</span>
                </div>
                <span className="font-mono text-xs text-muted-foreground">24%</span>
              </div>
              <Progress value={24} className={`h-1.5 ${getResourceProgressColor(24)}`} />
              <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
                <span>1.2 Gbps</span>
                <span>Low</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity - takes 2 columns, timeline design */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-serif">Activity Feed</CardTitle>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Latest Deployments & Changes
                </CardDescription>
              </div>
              <Badge variant="outline" className="font-mono text-[9px]">
                {recentActivity.length}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="space-y-0">
              {recentActivity.map((activity, index) => {
                const Icon = icons[activity.type];
                const isActive =
                  activity.status === "BUILDING" ||
                  activity.status === "DEPLOYING" ||
                  activity.status === "CREATING" ||
                  activity.status === "STARTING" ||
                  activity.status === "RUNNING" ||
                  activity.status === "HEALTHY";
                const isFailed = activity.status === "FAILED" || activity.status === "ERROR";

                return (
                  <div key={activity.id} className="group">
                    <div className="flex gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
                      {/* Timeline column */}
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <div
                            className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 transition-transform group-hover:scale-125 ${
                              isActive
                                ? "bg-primary border-primary animate-pulse"
                                : isFailed
                                  ? "bg-destructive border-destructive"
                                  : activity.status === "SUCCEEDED" || activity.status === "HEALTHY"
                                    ? "bg-success-500 border-success-500"
                                    : "bg-muted-foreground border-muted-foreground"
                            }`}
                          />
                          {isActive && (
                            <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                          )}
                        </div>
                        {index < recentActivity.length - 1 && (
                          <div className="w-0.5 flex-1 mt-2 min-h-12 bg-border" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`flex h-8 w-8 items-center justify-center rounded-md ${
                                isActive
                                  ? "bg-primary/10"
                                  : isFailed
                                    ? "bg-destructive/10"
                                    : "bg-muted"
                              } transition-colors group-hover:scale-110`}
                            >
                              <Icon
                                className={`h-4 w-4 ${
                                  isActive
                                    ? "text-primary"
                                    : isFailed
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-sans text-sm font-medium">
                                  {activity.project}
                                </span>
                                <span className="text-muted-foreground">/</span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {activity.service}
                                </span>
                              </div>
                              <p className="font-sans text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {activity.description}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2 shrink-0">
                            <StatusIndicator status={activity.status} size="sm" />
                            <span className="font-mono text-[9px] text-muted-foreground uppercase">
                              {activity.timestamp}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    {index < recentActivity.length - 1 && <Separator />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
