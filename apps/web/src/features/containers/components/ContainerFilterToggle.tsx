import { Switch } from "@/shared/components/ui/switch";

interface ContainerFilterToggleProps {
  activeCount: number;
  terminatedCount: number;
  showTerminated: boolean;
  onToggle: (show: boolean) => void;
}

/**
 * Toggle switch for showing/hiding terminated containers in list views.
 * Displays the count of terminated containers when non-zero.
 */
export function ContainerFilterToggle({
  terminatedCount,
  showTerminated,
  onToggle,
}: ContainerFilterToggleProps): React.ReactElement | null {
  if (terminatedCount === 0) {
    return null;
  }

  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <Switch size="sm" checked={showTerminated} onCheckedChange={onToggle} />
      <span className="text-xs text-muted-foreground">Show terminated ({terminatedCount})</span>
    </label>
  );
}
