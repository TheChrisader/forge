import { Card, CardContent } from "@/shared/components/ui/card";
import { CpuIcon, MemoryStickIcon, ArrowUpDownIcon, HardDriveIcon } from "lucide-react";
import { useServiceStats } from "@/core/api/hooks/useServices";
import { formatBytes } from "@/features/dashboard/lib/format";
import type { ServiceStatus } from "@forge/types";

interface ServiceStatsCardsProps {
  serviceId: string;
  serviceStatus: ServiceStatus;
}

function StatCard({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <Card className="group transition-all hover:shadow-lg">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function ProgressBar({ percent }: { percent: number }): React.ReactElement {
  const color =
    percent < 60 ? "bg-success-500" : percent < 80 ? "bg-warning-500" : "bg-destructive";

  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${color}`}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export function ServiceStatsCards({
  serviceId,
  serviceStatus,
}: ServiceStatsCardsProps): React.ReactElement | null {
  const isRunning = serviceStatus === "RUNNING" || serviceStatus === "HEALTHY";

  const { data } = useServiceStats(serviceId);

  if (!isRunning) return null;

  const stats = data?.data;
  if (!stats) return null;

  const cpuPercent = (stats.cpuPercent as number) ?? 0;
  const memoryUsed = (stats.memoryUsedBytes as number) ?? 0;
  const memoryLimit = (stats.memoryLimitBytes as number) ?? 0;
  const networkRx = (stats.networkRxBytes as number) ?? 0;
  const networkTx = (stats.networkTxBytes as number) ?? 0;
  const blockRead = (stats.blockReadBytes as number) ?? 0;
  const blockWrite = (stats.blockWriteBytes as number) ?? 0;
  const memoryPercent = memoryLimit > 0 ? (memoryUsed / memoryLimit) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard icon={CpuIcon} label="CPU">
        <p className="font-mono text-lg font-semibold">{cpuPercent.toFixed(1)}%</p>
        <ProgressBar percent={cpuPercent} />
      </StatCard>

      <StatCard icon={MemoryStickIcon} label="Memory">
        <p className="font-mono text-lg font-semibold">{formatBytes(memoryUsed)}</p>
        <p className="font-mono text-[10px] text-muted-foreground">of {formatBytes(memoryLimit)}</p>
        <ProgressBar percent={memoryPercent} />
      </StatCard>

      <StatCard icon={ArrowUpDownIcon} label="Network">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">RX</span>
            <span className="font-mono text-xs">{formatBytes(networkRx)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">TX</span>
            <span className="font-mono text-xs">{formatBytes(networkTx)}</span>
          </div>
        </div>
      </StatCard>

      <StatCard icon={HardDriveIcon} label="Block I/O">
        <div className="space-y-1">
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">Read</span>
            <span className="font-mono text-xs">{formatBytes(blockRead)}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-mono text-[10px] text-muted-foreground">Write</span>
            <span className="font-mono text-xs">{formatBytes(blockWrite)}</span>
          </div>
        </div>
      </StatCard>
    </div>
  );
}
