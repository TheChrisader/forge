import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import type { ContainerStats } from "@forge/types";
import { Cpu, HardDrive, Network, Activity } from "lucide-react";
import { formatBytes } from "@/shared/lib/utils";

interface ContainerStatsCardProps {
  stats: ContainerStats | null | undefined;
  isLoading?: boolean;
}

export function ContainerStatsCard({
  stats,
  isLoading = false,
}: ContainerStatsCardProps): React.ReactElement {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Resource Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            Loading stats...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Resource Usage
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            No stats available
          </div>
        </CardContent>
      </Card>
    );
  }

  const cpuPercent = Number(stats.cpu.usage.toFixed(1));
  const memoryPercent = Number(stats.memory.percentage.toFixed(1));
  const memoryUsed = formatBytes(stats.memory.usage);
  const memoryLimit = formatBytes(stats.memory.limit);
  const networkRx = formatBytes(stats.network.rxBytes);
  const networkTx = formatBytes(stats.network.txBytes);
  const blockRead = formatBytes(stats.blockIO.readBytes);
  const blockWrite = formatBytes(stats.blockIO.writeBytes);

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">CPU Usage</CardTitle>
          <Cpu className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{cpuPercent}%</div>
          <p className="text-xs text-muted-foreground">{stats.cpu.onlineCpus} cores available</p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${Math.min(cpuPercent, 100)}%` }} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Memory Usage</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{memoryPercent}%</div>
          <p className="text-xs text-muted-foreground">
            {memoryUsed} / {memoryLimit}
          </p>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full bg-primary"
              style={{ width: `${Math.min(memoryPercent, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Network I/O</CardTitle>
          <Network className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">RX:</span>
              <span className="font-medium">{networkRx}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">TX:</span>
              <span className="font-medium">{networkTx}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Disk I/O</CardTitle>
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Read:</span>
              <span className="font-medium">{blockRead}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Write:</span>
              <span className="font-medium">{blockWrite}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
