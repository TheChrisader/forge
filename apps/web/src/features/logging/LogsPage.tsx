import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ButtonGroup } from "@/shared/components/ui/button-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
} from "@/shared/components/ui/item";
import { Separator } from "@/shared/components/ui/separator";
import { Empty } from "@/shared/components/ui/empty";
import { EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import {
  RefreshCwIcon,
  SearchIcon,
  FileTextIcon,
  AlertTriangleIcon,
  InfoIcon,
  BugIcon,
} from "lucide-react";
import type { LogLevel } from "@forge/types";

const mockLogs = [
  {
    id: "log-1",
    service: "web-app",
    level: "INFO" as LogLevel,
    message: "Application started successfully on port 3000",
    timestamp: "2024-02-09 14:32:15",
    source: "server.ts:45",
  },
  {
    id: "log-2",
    service: "api-gateway",
    level: "ERROR" as LogLevel,
    message: "Failed to connect to database: connection timeout",
    timestamp: "2024-02-09 14:31:42",
    source: "db.ts:128",
  },
  {
    id: "log-3",
    service: "auth-service",
    level: "WARN" as LogLevel,
    message: "Rate limit exceeded for IP 192.168.1.100",
    timestamp: "2024-02-09 14:31:30",
    source: "middleware.ts:67",
  },
  {
    id: "log-4",
    service: "web-app",
    level: "INFO" as LogLevel,
    message: "New user registration: user@example.com",
    timestamp: "2024-02-09 14:30:58",
    source: "auth.ts:234",
  },
  {
    id: "log-5",
    service: "background-jobs",
    level: "DEBUG" as LogLevel,
    message: "Processing job queue: 15 pending jobs",
    timestamp: "2024-02-09 14:30:45",
    source: "worker.ts:89",
  },
  {
    id: "log-6",
    service: "api-gateway",
    level: "INFO" as LogLevel,
    message: "API request completed: GET /api/users - 200 (45ms)",
    timestamp: "2024-02-09 14:30:30",
    source: "router.ts:156",
  },
  {
    id: "log-7",
    service: "email-processor",
    level: "ERROR" as LogLevel,
    message: "Failed to send email: SMTP server unreachable",
    timestamp: "2024-02-09 14:29:15",
    source: "email.ts:78",
  },
  {
    id: "log-8",
    service: "web-app",
    level: "WARN" as LogLevel,
    message: "High memory usage detected: 85% of heap",
    timestamp: "2024-02-09 14:28:50",
    source: "monitor.ts:34",
  },
  {
    id: "log-9",
    service: "auth-service",
    level: "INFO" as LogLevel,
    message: "JWT token generated for user@example.com",
    timestamp: "2024-02-09 14:28:22",
    source: "jwt.ts:112",
  },
  {
    id: "log-10",
    service: "api-gateway",
    level: "DEBUG" as LogLevel,
    message: "Cache hit for key: user_12345_profile",
    timestamp: "2024-02-09 14:28:10",
    source: "cache.ts:45",
  },
  {
    id: "log-11",
    service: "background-jobs",
    level: "INFO" as LogLevel,
    message: "Job completed successfully: email_notifications",
    timestamp: "2024-02-09 14:27:45",
    source: "worker.ts:201",
  },
  {
    id: "log-12",
    service: "web-app",
    level: "ERROR" as LogLevel,
    message: "Unhandled exception: Cannot read property 'id' of undefined",
    timestamp: "2024-02-09 14:27:30",
    source: "controller.ts:89",
  },
];

const logLevelConfig: Record<LogLevel, { color: string; icon: React.ReactNode; label: string }> = {
  ERROR: {
    color: "bg-destructive/10 text-destructive",
    icon: <AlertTriangleIcon className="size-3" />,
    label: "Error",
  },
  WARN: {
    color: "bg-warning-500/10 text-warning-700 dark:text-warning-400",
    icon: <AlertTriangleIcon className="size-3" />,
    label: "Warning",
  },
  INFO: {
    color: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
    icon: <InfoIcon className="size-3" />,
    label: "Info",
  },
  DEBUG: {
    color: "bg-muted text-muted-foreground",
    icon: <BugIcon className="size-3" />,
    label: "Debug",
  },
  TRACE: {
    color: "bg-muted text-muted-foreground",
    icon: <BugIcon className="size-3" />,
    label: "Trace",
  },
  FATAL: {
    color: "bg-destructive/10 text-destructive",
    icon: <AlertTriangleIcon className="size-3" />,
    label: "Fatal",
  },
};

const filterLogsByLevel = (
  logs: typeof mockLogs,
  level?: "all" | "errors" | "warnings" | LogLevel
): typeof mockLogs => {
  if (!level || level === "all") return logs;
  if (level === "errors") return logs.filter((log) => log.level === "ERROR");
  if (level === "warnings")
    return logs.filter((log) => log.level === "WARN" || log.level === "ERROR");
  return logs.filter((log) => log.level === level);
};

export function LogsPage(): React.ReactElement {
  const allLogs = filterLogsByLevel(mockLogs, "all");
  const errorLogs = filterLogsByLevel(mockLogs, "errors");
  const warningLogs = filterLogsByLevel(mockLogs, "warnings");

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Logs</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm">
              <RefreshCwIcon />
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select defaultValue="all">
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Service" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                <SelectItem value="web-app">web-app</SelectItem>
                <SelectItem value="api-gateway">api-gateway</SelectItem>
                <SelectItem value="auth-service">auth-service</SelectItem>
                <SelectItem value="background-jobs">background-jobs</SelectItem>
                <SelectItem value="email-processor">email-processor</SelectItem>
              </SelectContent>
            </Select>

            <ButtonGroup>
              <Button variant="default" size="sm">
                All
              </Button>
              <Button variant="outline" size="sm">
                Errors
              </Button>
              <Button variant="outline" size="sm">
                Warnings
              </Button>
            </ButtonGroup>

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search logs..." className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="all">
        <TabsList>
          <TabsTrigger value="all">All Logs ({allLogs.length})</TabsTrigger>
          <TabsTrigger value="errors">Errors ({errorLogs.length})</TabsTrigger>
          <TabsTrigger value="warnings">Warnings ({warningLogs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <LogsList logs={allLogs} />
        </TabsContent>

        <TabsContent value="errors">
          <LogsList logs={errorLogs} />
        </TabsContent>

        <TabsContent value="warnings">
          <LogsList logs={warningLogs} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LogsList({ logs }: { logs: typeof mockLogs }): React.ReactElement {
  if (logs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No logs found</EmptyTitle>
          <EmptyDescription>
            Try adjusting your filters or search terms to find what you're looking for.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <ItemGroup>
          {logs.map((log, index) => {
            const config = logLevelConfig[log.level];
            return (
              <Item key={log.id}>
                <ItemMedia variant="icon">
                  <FileTextIcon />
                </ItemMedia>
                <ItemContent className="flex-1">
                  <ItemTitle className="flex items-center gap-2">
                    <span className="font-mono text-xs">{log.service}</span>
                    <Badge className={config.color} variant="outline">
                      {config.icon}
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-normal">
                      {log.timestamp}
                    </span>
                  </ItemTitle>
                  <ItemDescription className="font-mono text-xs">{log.message}</ItemDescription>
                  <ItemDescription className="text-xs text-muted-foreground">
                    {log.source}
                  </ItemDescription>
                </ItemContent>
                {index < logs.length - 1 && <Separator />}
              </Item>
            );
          })}
        </ItemGroup>
      </CardContent>
    </Card>
  );
}
