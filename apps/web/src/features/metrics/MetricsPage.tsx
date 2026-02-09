import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Progress } from "@/shared/components/ui/progress";
import { Badge } from "@/shared/components/ui/badge";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/shared/components/ui/item";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CpuIcon, MemoryStickIcon, ActivityIcon, AlertTriangleIcon, ClockIcon } from "lucide-react";

const mockMetrics = {
  cpu: {
    current: 68,
    average: 54,
    peak: 92,
    threshold: 80,
    status: "warning" as const,
  },
  memory: {
    current: 8.2,
    total: 16,
    average: 7.5,
    peak: 14.1,
    threshold: 85,
    status: "success" as const,
  },
  requests: {
    current: 1247,
    average: 1089,
    peak: 3456,
    perSecond: 42,
    status: "success" as const,
  },
  errors: {
    current: 23,
    average: 15,
    peak: 156,
    rate: 1.8,
    status: "error" as const,
  },
  uptime: {
    current: 99.94,
    target: 99.9,
    status: "success" as const,
  },
};

const mockAlerts = [
  {
    id: "alert-1",
    severity: "error" as const,
    title: "High CPU Usage",
    description: "web-app CPU usage exceeded 80% threshold",
    timestamp: "2 minutes ago",
  },
  {
    id: "alert-2",
    severity: "error" as const,
    title: "Memory Warning",
    description: "api-gateway memory usage approaching threshold",
    timestamp: "15 minutes ago",
  },
  {
    id: "alert-3",
    severity: "error" as const,
    title: "Database Connection Failed",
    description: "Failed to establish connection to primary database",
    timestamp: "1 hour ago",
  },
  {
    id: "alert-4",
    severity: "error" as const,
    title: "Disk Space Low",
    description: "Server disk usage at 85% capacity",
    timestamp: "3 hours ago",
  },
];

const getThresholdBadge = (
  value: number,
  threshold: number
): { variant: "destructive" | "default" | "secondary"; label: string } => {
  const percentage = (value / threshold) * 100;
  if (percentage >= 100) return { variant: "destructive" as const, label: "Critical" };
  if (percentage >= 80) return { variant: "default" as const, label: "Warning" };
  return { variant: "secondary" as const, label: "Normal" };
};

export function MetricsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Metrics</h1>
          <p className="text-muted-foreground">Monitor your infrastructure performance</p>
        </div>

        <div className="flex items-center gap-3">
          <Select defaultValue="all">
            <SelectTrigger size="sm" className="w-45">
              <SelectValue placeholder="Select service" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Services</SelectItem>
              <SelectItem value="web-app">web-app</SelectItem>
              <SelectItem value="api-gateway">api-gateway</SelectItem>
              <SelectItem value="auth-service">auth-service</SelectItem>
              <SelectItem value="background-jobs">background-jobs</SelectItem>
            </SelectContent>
          </Select>

          <Tabs defaultValue="24h">
            <TabsList>
              <TabsTrigger value="1h">1h</TabsTrigger>
              <TabsTrigger value="6h">6h</TabsTrigger>
              <TabsTrigger value="24h">24h</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <CpuIcon className="size-4" />
              CPU Usage
            </CardDescription>
            <CardTitle className="text-3xl">{mockMetrics.cpu.current}%</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Avg: {mockMetrics.cpu.average}%</span>
              <span className="text-muted-foreground">Peak: {mockMetrics.cpu.peak}%</span>
            </div>
            <Progress value={mockMetrics.cpu.current} />
            <Badge
              variant={
                getThresholdBadge(mockMetrics.cpu.current, mockMetrics.cpu.threshold).variant
              }
              className="text-xs"
            >
              {getThresholdBadge(mockMetrics.cpu.current, mockMetrics.cpu.threshold).label}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <MemoryStickIcon className="size-4" />
              Memory
            </CardDescription>
            <CardTitle className="text-3xl">{mockMetrics.memory.current} GB</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">of {mockMetrics.memory.total} GB</span>
              <span className="text-muted-foreground">Peak: {mockMetrics.memory.peak} GB</span>
            </div>
            <Progress value={(mockMetrics.memory.current / mockMetrics.memory.total) * 100} />
            <Badge
              variant={
                getThresholdBadge(
                  (mockMetrics.memory.current / mockMetrics.memory.total) * 100,
                  mockMetrics.memory.threshold
                ).variant
              }
              className="text-xs"
            >
              {
                getThresholdBadge(
                  (mockMetrics.memory.current / mockMetrics.memory.total) * 100,
                  mockMetrics.memory.threshold
                ).label
              }
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ActivityIcon className="size-4" />
              Requests
            </CardDescription>
            <CardTitle className="text-3xl">{mockMetrics.requests.current}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{mockMetrics.requests.perSecond}/sec</span>
              <span className="text-muted-foreground">Peak: {mockMetrics.requests.peak}</span>
            </div>
            <Progress value={(mockMetrics.requests.current / mockMetrics.requests.peak) * 100} />
            <Badge variant="secondary" className="text-xs">
              {mockMetrics.requests.status === "success" ? "Healthy" : "Warning"}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <AlertTriangleIcon className="size-4" />
              Errors
            </CardDescription>
            <CardTitle className="text-3xl">{mockMetrics.errors.current}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{mockMetrics.errors.rate}% rate</span>
              <span className="text-muted-foreground">Peak: {mockMetrics.errors.peak}</span>
            </div>
            <Progress value={(mockMetrics.errors.current / mockMetrics.errors.peak) * 100} />
            <StatusIndicator status={mockMetrics.errors.status} size="sm" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ClockIcon className="size-4" />
              Uptime
            </CardDescription>
            <CardTitle className="text-3xl">{mockMetrics.uptime.current}%</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Target: {mockMetrics.uptime.target}%</span>
              <span className="text-muted-foreground">Last 30 days</span>
            </div>
            <Progress value={mockMetrics.uptime.current} />
            <StatusIndicator status={mockMetrics.uptime.status} size="sm" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="flex items-center gap-2">
              <ActivityIcon className="size-4" />
              Response Time
            </CardDescription>
            <CardTitle className="text-3xl">124 ms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">P50: 89ms</span>
              <span className="text-muted-foreground">P99: 456ms</span>
            </div>
            <div className="space-y-2">
              <Skeleton className="h-2 w-full" />
              <Skeleton className="h-2 w-3/4" />
            </div>
            <Badge variant="secondary" className="text-xs">
              Loading...
            </Badge>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Active Alerts</CardTitle>
              <CardDescription>System alerts requiring attention</CardDescription>
            </div>
            <Badge variant="destructive">{mockAlerts.length} Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <ItemGroup>
            {mockAlerts.map((alert) => (
              <Item key={alert.id}>
                <ItemMedia variant="icon">
                  <AlertTriangleIcon />
                </ItemMedia>
                <ItemContent>
                  <ItemTitle>{alert.title}</ItemTitle>
                  <ItemDescription>{alert.description}</ItemDescription>
                </ItemContent>
                <div className="ml-auto flex flex-col items-end gap-2">
                  <StatusIndicator status={alert.severity} size="sm" />
                  <span className="text-xs text-muted-foreground">{alert.timestamp}</span>
                </div>
              </Item>
            ))}
          </ItemGroup>
        </CardContent>
      </Card>
    </div>
  );
}
