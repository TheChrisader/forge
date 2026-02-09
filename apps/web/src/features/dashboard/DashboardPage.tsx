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
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/shared/components/ui/item";
import { Separator } from "@/shared/components/ui/separator";
import { ServerIcon, RocketIcon } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ServiceStatus } from "@forge/types";

// Mock data for stat cards
const stats = [
  {
    title: "Projects",
    value: "12",
    trend: "+2 this month",
    trendValue: 12,
    trendPositive: true,
  },
  {
    title: "Services",
    value: "24",
    trend: "+5 this week",
    trendValue: 8,
    trendPositive: true,
  },
  {
    title: "Deployments",
    value: "156",
    trend: "+18 today",
    trendValue: 18,
    trendPositive: true,
  },
  {
    title: "Containers",
    value: "48",
    trend: "-3 from peak",
    trendValue: 3,
    trendPositive: false,
  },
];

const recentActivity = [
  {
    id: "act-1",
    type: "deployment",
    project: "forge-web",
    service: "web-app",
    status: "success" as ServiceStatus,
    description: "Deployment completed successfully",
    timestamp: "2 minutes ago",
  },
  {
    id: "act-2",
    type: "service",
    project: "forge-api",
    service: "auth-service",
    status: "running" as ServiceStatus,
    description: "Service restarted automatically",
    timestamp: "15 minutes ago",
  },
  {
    id: "act-3",
    type: "deployment",
    project: "forge-worker",
    service: "background-jobs",
    status: "failed" as ServiceStatus,
    description: "Deployment failed, rolling back",
    timestamp: "1 hour ago",
  },
  {
    id: "act-4",
    type: "service",
    project: "forge-web",
    service: "admin-dashboard",
    status: "running" as ServiceStatus,
    description: "New service created",
    timestamp: "3 hours ago",
  },
  {
    id: "act-5",
    type: "deployment",
    project: "forge-api",
    service: "api-gateway",
    status: "building" as ServiceStatus,
    description: "Deployment in progress",
    timestamp: "Just now",
  },
];

const icons: Record<string, LucideIcon> = {
  deployment: RocketIcon,
  service: ServerIcon,
};

export function DashboardPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your Forge platform infrastructure</p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="pb-3">
              <CardDescription>{stat.title}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-2">
                <Badge variant={stat.trendPositive ? "default" : "destructive"} className="text-xs">
                  {stat.trend}
                </Badge>
                <Progress value={stat.trendValue} className="h-1.5 flex-1" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resource Utilization</CardTitle>
          <CardDescription>Current resource usage across all containers</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* CPU */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">CPU Usage</span>
              <span className="text-muted-foreground">68%</span>
            </div>
            <Progress value={68} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Memory Usage</span>
              <span className="text-muted-foreground">8.2 GB / 16 GB</span>
            </div>
            <Progress value={51} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Storage</span>
              <span className="text-muted-foreground">234 GB / 500 GB</span>
            </div>
            <Progress value={47} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Network I/O</span>
              <span className="text-muted-foreground">1.2 Gbps</span>
            </div>
            <Progress value={24} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest deployments and service changes</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ItemGroup>
            {recentActivity.map((activity, index) => {
              const Icon = icons[activity.type];
              return (
                <Item key={activity.id}>
                  <ItemMedia variant="icon">
                    <Icon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {activity.project}
                      <span className="text-muted-foreground"> / </span>
                      {activity.service}
                    </ItemTitle>
                    <ItemDescription>{activity.description}</ItemDescription>
                  </ItemContent>
                  <div className="ml-auto flex flex-col items-end gap-2">
                    <StatusIndicator status={activity.status} size="sm" />
                    <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                  </div>
                  {index < recentActivity.length - 1 && <Separator />}
                </Item>
              );
            })}
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  );
}
