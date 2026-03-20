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
import { Separator } from "@/shared/components/ui/separator";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { CpuIcon, MemoryStickIcon, ActivityIcon, AlertTriangleIcon, ClockIcon } from "lucide-react";

const mockMetrics = {
  cpu: {
    current: 68,
    average: 54,
    peak: 92,
    threshold: 80,
    status: "WARN" as const,
  },
  memory: {
    current: 8.2,
    total: 16,
    average: 7.5,
    peak: 14.1,
    threshold: 85,
    status: "INFO" as const,
  },
  requests: {
    current: 1247,
    average: 1089,
    peak: 3456,
    perSecond: 42,
    status: "INFO" as const,
  },
  errors: {
    current: 23,
    average: 15,
    peak: 156,
    rate: 1.8,
    status: "ERROR" as const,
  },
  uptime: {
    current: 99.94,
    target: 99.9,
    status: "INFO" as const,
  },
};

const mockAlerts = [
  {
    id: "alert-1",
    severity: "ERROR" as const,
    title: "High CPU Usage",
    description: "web-app CPU usage exceeded 80% threshold",
    timestamp: "2 minutes ago",
  },
  {
    id: "alert-2",
    severity: "ERROR" as const,
    title: "Memory Warning",
    description: "api-gateway memory usage approaching threshold",
    timestamp: "15 minutes ago",
  },
  {
    id: "alert-3",
    severity: "ERROR" as const,
    title: "Database Connection Failed",
    description: "Failed to establish connection to primary database",
    timestamp: "1 hour ago",
  },
  {
    id: "alert-4",
    severity: "ERROR" as const,
    title: "Disk Space Low",
    description: "Server disk usage at 85% capacity",
    timestamp: "3 hours ago",
  },
];

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

export function MetricsPage(): React.ReactElement {
  const memPercentage = (mockMetrics.memory.current / mockMetrics.memory.total) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 pb-4">
        <div>
          <h1 className="font-serif text-3xl font-bold tracking-tight">Metrics</h1>
          <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Infrastructure Performance
          </p>
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

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <CpuIcon className="h-4 w-4 text-primary" />
                </div>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  CPU Usage
                </CardDescription>
              </div>
            </div>
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">
              {mockMetrics.cpu.current}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>Avg: {mockMetrics.cpu.average}%</span>
              <span>Peak: {mockMetrics.cpu.peak}%</span>
            </div>
            <Progress
              value={mockMetrics.cpu.current}
              className={`h-1.5 ${getResourceProgressColor(mockMetrics.cpu.current)}`}
            />
            <span
              className={`font-mono text-[9px] uppercase ${
                mockMetrics.cpu.current >= 80 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {getResourceLabel(mockMetrics.cpu.current)}
            </span>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <MemoryStickIcon className="h-4 w-4 text-primary" />
                </div>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Memory
                </CardDescription>
              </div>
            </div>
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">
              {mockMetrics.memory.current} GB
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>of {mockMetrics.memory.total} GB</span>
              <span>Peak: {mockMetrics.memory.peak} GB</span>
            </div>
            <Progress
              value={memPercentage}
              className={`h-1.5 ${getResourceProgressColor(memPercentage)}`}
            />
            <span
              className={`font-mono text-[9px] uppercase ${
                memPercentage >= 80 ? "text-destructive" : "text-muted-foreground"
              }`}
            >
              {getResourceLabel(memPercentage)}
            </span>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <ActivityIcon className="h-4 w-4 text-primary" />
                </div>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Requests
                </CardDescription>
              </div>
            </div>
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">
              {mockMetrics.requests.current}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>{mockMetrics.requests.perSecond}/sec</span>
              <span>Peak: {mockMetrics.requests.peak}</span>
            </div>
            <Progress
              value={(mockMetrics.requests.current / mockMetrics.requests.peak) * 100}
              className="h-1.5"
            />
            <span className="font-mono text-[9px] uppercase text-muted-foreground">Normal</span>
          </CardContent>
        </Card>

        <Card className="group overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 group-hover:bg-destructive/20 transition-colors">
                  <AlertTriangleIcon className="h-4 w-4 text-destructive" />
                </div>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Errors
                </CardDescription>
              </div>
            </div>
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">
              {mockMetrics.errors.current}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>{mockMetrics.errors.rate}% rate</span>
              <span>Peak: {mockMetrics.errors.peak}</span>
            </div>
            <Progress
              value={(mockMetrics.errors.current / mockMetrics.errors.peak) * 100}
              className="h-1.5 [&>div]:bg-destructive"
            />
            <StatusIndicator status={mockMetrics.errors.status} size="sm" />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-muted-foreground" />
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Uptime
              </CardDescription>
            </div>
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">
              {mockMetrics.uptime.current}%
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>Target: {mockMetrics.uptime.target}%</span>
              <span>Last 30 days</span>
            </div>
            <Progress value={mockMetrics.uptime.current} className="h-1.5" />
            <StatusIndicator status={mockMetrics.uptime.status} size="sm" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ActivityIcon className="h-4 w-4 text-muted-foreground" />
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Response Time
              </CardDescription>
            </div>
            <CardTitle className="font-serif text-3xl font-bold tracking-tight">124 ms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between font-mono text-[9px] text-muted-foreground">
              <span>P50: 89ms</span>
              <span>P99: 456ms</span>
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-1.5 w-full" />
              <Skeleton className="h-1.5 w-3/4" />
            </div>
            <span className="font-mono text-[9px] uppercase text-muted-foreground">Loading...</span>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif">Active Alerts</CardTitle>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                System Alerts Requiring Attention
              </CardDescription>
            </div>
            <Badge variant="destructive" className="font-mono text-[9px]">
              {mockAlerts.length} Active
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="space-y-0">
            {mockAlerts.map((alert, index) => (
              <div key={alert.id} className="group">
                <div className="flex gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-destructive/10 group-hover:bg-destructive/20 transition-colors group-hover:scale-110">
                    <AlertTriangleIcon className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-sans text-sm font-medium">{alert.title}</p>
                        <p className="font-sans text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {alert.description}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <StatusIndicator status={alert.severity} size="sm" />
                        <span className="font-mono text-[9px] text-muted-foreground uppercase">
                          {alert.timestamp}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
                {index < mockAlerts.length - 1 && <Separator />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
