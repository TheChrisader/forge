import { Button } from "@/shared/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { Play, Square, RefreshCw, Trash2, FileText, Settings, LoaderIcon } from "lucide-react";
import type { ContainerStatus } from "@forge/database";
import {
  useStartContainer,
  useStopContainer,
  useRestartContainer,
  useRemoveContainer,
} from "@/core/api/hooks";
import { useState } from "react";

interface ContainerActionsProps {
  containerId: string;
  status: ContainerStatus;
  onStart?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  onRemove?: () => void;
  onViewLogs?: () => void;
  onViewDetails?: () => void;
}

export function ContainerActions({
  containerId,
  status,
  onStart,
  onStop,
  onRestart,
  onRemove,
  onViewLogs,
  onViewDetails,
}: ContainerActionsProps): React.ReactElement {
  const startMutation = useStartContainer();
  const stopMutation = useStopContainer();
  const restartMutation = useRestartContainer();
  const removeMutation = useRemoveContainer();
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const isRunning = status === "RUNNING" || status === "HEALTHY" || status === "UNHEALTHY";
  const isStopped = status === "STOPPED" || status === "TERMINATED";
  const isTransitioning =
    status === "CREATING" ||
    status === "STARTING" ||
    status === "STOPPING" ||
    status === "RESTARTING";
  const isLoading =
    startMutation.isPending ||
    stopMutation.isPending ||
    restartMutation.isPending ||
    removeMutation.isPending;

  const handleStart = (): void => {
    startMutation.mutate(containerId, {
      onSuccess: () => onStart?.(),
    });
  };

  const handleStop = (): void => {
    stopMutation.mutate(
      { containerId, timeout: 10 },
      {
        onSuccess: () => onStop?.(),
      }
    );
  };

  const handleRestart = (): void => {
    restartMutation.mutate(containerId, {
      onSuccess: () => onRestart?.(),
    });
  };

  const handleRemove = (): void => {
    setIsRemoveDialogOpen(true);
  };

  const handleConfirmRemove = (): void => {
    removeMutation.mutate(
      { containerId, force: false },
      {
        onSuccess: () => {
          setIsRemoveDialogOpen(false);
          onRemove?.();
        },
      }
    );
  };

  return (
    <div className="flex items-center gap-2">
      {onViewDetails && (
        <Button variant="ghost" size="sm" onClick={onViewDetails} disabled={isLoading}>
          <Settings className="h-4 w-4" />
        </Button>
      )}

      {onViewLogs && (
        <Button variant="ghost" size="sm" onClick={onViewLogs} disabled={isLoading}>
          <FileText className="h-4 w-4" />
        </Button>
      )}

      {!isStopped && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRestart}
          disabled={isLoading || isTransitioning}
          title="Restart"
        >
          {restartMutation.isPending ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      )}

      {isRunning && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStop}
          disabled={isLoading || isTransitioning}
          title="Stop"
        >
          {stopMutation.isPending ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <Square className="h-4 w-4" />
          )}
        </Button>
      )}

      {isStopped && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleStart}
          disabled={isLoading || isTransitioning}
          title="Start"
        >
          {startMutation.isPending ? (
            <LoaderIcon className="h-4 w-4 animate-spin" />
          ) : (
            <Play className="h-4 w-4" />
          )}
        </Button>
      )}

      <Button variant="ghost" size="sm" onClick={handleRemove} disabled={isLoading} title="Remove">
        {removeMutation.isPending ? (
          <LoaderIcon className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4 text-destructive" />
        )}
      </Button>

      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Container</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove this container? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmRemove}
              disabled={removeMutation.isPending}
              variant="destructive"
            >
              {removeMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <LoaderIcon className="h-4 w-4 animate-spin" />
                  Removing...
                </span>
              ) : (
                "Remove"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
