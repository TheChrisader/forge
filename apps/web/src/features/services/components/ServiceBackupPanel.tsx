import { useState, useCallback } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/shared/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import {
  ShieldIcon,
  PlusIcon,
  RotateCcwIcon,
  LoaderIcon,
  AlertTriangleIcon,
  ClockIcon,
} from "lucide-react";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import {
  useServiceBackups,
  useTriggerBackup,
  useRestoreBackup,
  useUpdateBackupSchedule,
} from "@/core/api/hooks/useServices";
import { formatBytes } from "@/features/dashboard/lib/format";
import { formatRelativeTime } from "@/features/dashboard/lib/format";
import type { ServiceBackup, ServiceStatus } from "@forge/types";

interface ServiceBackupPanelProps {
  serviceId: string;
  serviceStatus: ServiceStatus;
  autoBackupSchedule: string | null;
  autoBackupRetention: number | null;
}

const TYPE_LABELS: Record<string, string> = {
  MANUAL: "Manual",
  SCHEDULED: "Scheduled",
  PRE_UPGRADE: "Pre-Upgrade",
};

function formatDuration(
  startedAt: Date | string | null,
  completedAt: Date | string | null
): string {
  if (!startedAt || !completedAt) return "—";
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.floor((ms % 60_000) / 1000)}s`;
}

export function ServiceBackupPanel({
  serviceId,
  serviceStatus,
  autoBackupSchedule,
  autoBackupRetention,
}: ServiceBackupPanelProps): React.ReactElement {
  const isRunning = serviceStatus === "RUNNING" || serviceStatus === "HEALTHY";

  const { data: backupsData, isLoading } = useServiceBackups(serviceId);
  const triggerMutation = useTriggerBackup();
  const restoreMutation = useRestoreBackup();
  const scheduleMutation = useUpdateBackupSchedule();

  const [restoreTarget, setRestoreTarget] = useState<ServiceBackup | null>(null);
  const [schedule, setSchedule] = useState(autoBackupSchedule ?? "daily");
  const [retention, setRetention] = useState(autoBackupRetention?.toString() ?? "7");
  const [editingSchedule, setEditingSchedule] = useState(false);

  const backups = backupsData?.data ?? [];

  const handleTrigger = useCallback(() => {
    void triggerMutation.mutate(serviceId);
  }, [triggerMutation, serviceId]);

  const handleRestore = useCallback(() => {
    if (!restoreTarget) return;
    void restoreMutation.mutate(
      { serviceId, backupId: restoreTarget.id },
      { onSuccess: () => setRestoreTarget(null) }
    );
  }, [restoreTarget, restoreMutation, serviceId]);

  const handleSaveSchedule = useCallback(() => {
    void scheduleMutation.mutate(
      {
        serviceId,
        data: {
          schedule: schedule as "daily" | "weekly",
          retention: parseInt(retention, 10),
        },
      },
      { onSuccess: () => setEditingSchedule(false) }
    );
  }, [scheduleMutation, serviceId, schedule, retention]);

  return (
    <div className="space-y-6">
      {/* Schedule card */}
      <Card className="group transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-serif">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ClockIcon className="h-4 w-4 text-primary" />
              </div>
              Backup Schedule
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setEditingSchedule((v) => !v)}>
              {editingSchedule ? "Cancel" : "Edit"}
            </Button>
          </div>
          <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
            {autoBackupSchedule
              ? `Every ${autoBackupSchedule}, keep last ${autoBackupRetention ?? 7}`
              : "No schedule configured"}
          </CardDescription>
        </CardHeader>
        {editingSchedule && (
          <CardContent>
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Frequency
                </label>
                <Select value={schedule} onValueChange={setSchedule}>
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="none">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {schedule !== "none" && (
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Retention
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    value={retention}
                    onChange={(e) => setRetention(e.target.value)}
                    className="font-mono text-sm w-24"
                  />
                </div>
              )}
              <Button size="sm" onClick={handleSaveSchedule} disabled={scheduleMutation.isPending}>
                {scheduleMutation.isPending ? (
                  <LoaderIcon className="h-3 w-3 animate-spin mr-1.5" />
                ) : null}
                Save
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Backups list */}
      <Card className="group transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-serif">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <ShieldIcon className="h-4 w-4 text-primary" />
              </div>
              Backups
              <Badge variant="secondary" className="font-mono text-[10px]">
                {backups.length}
              </Badge>
            </CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={handleTrigger}
              disabled={!isRunning || triggerMutation.isPending}
              className="group"
            >
              {triggerMutation.isPending ? (
                <LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <PlusIcon className="h-3.5 w-3.5 mr-1.5 group-hover:scale-110 transition-transform" />
              )}
              Trigger Backup
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <LoaderIcon className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : backups.length === 0 ? (
            <div className="py-12 text-center">
              <p className="font-sans text-sm text-muted-foreground">No backups yet</p>
              <p className="font-sans text-xs text-muted-foreground/60 mt-1">
                Trigger a manual backup or set up a schedule
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border/50 hover:bg-transparent">
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Type
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Status
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Size
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Started
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Duration
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {backups.map((backup) => (
                  <TableRow key={backup.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        {TYPE_LABELS[backup.type] ?? backup.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <StatusIndicator status={backup.status} size="sm" />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs">{formatBytes(Number(backup.size))}</span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {backup.startedAt
                          ? formatRelativeTime(new Date(backup.startedAt).toISOString())
                          : "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatDuration(backup.startedAt, backup.completedAt)}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="xs"
                        disabled={backup.status !== "COMPLETED"}
                        onClick={() => setRestoreTarget(backup)}
                        className="font-mono text-[10px]"
                      >
                        <RotateCcwIcon className="h-3 w-3 mr-1" />
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Restore confirmation dialog */}
      <Dialog open={!!restoreTarget} onOpenChange={(open) => !open && setRestoreTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore from Backup</DialogTitle>
            <DialogDescription>
              This will restore the service to the state from{" "}
              {restoreTarget?.startedAt
                ? formatRelativeTime(new Date(restoreTarget.startedAt).toISOString())
                : "this backup"}
              . All current data will be replaced.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-3 rounded-md border border-warning/50 bg-warning/10 px-3 py-2">
            <AlertTriangleIcon className="h-4 w-4 text-warning shrink-0" />
            <p className="font-sans text-sm text-warning-foreground">
              This action will replace all current service data with the backup data.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRestoreTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRestore}
              disabled={restoreMutation.isPending}
            >
              {restoreMutation.isPending ? (
                <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Restore
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
