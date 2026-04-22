import { Tabs, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { cn } from "@/shared/lib/utils";
import type { TimeRange, TimeRangePreset } from "./chart-types";

const DEFAULT_PRESETS: TimeRangePreset[] = [
  { label: "15m", durationMs: 15 * 60 * 1000, interval: "1m" },
  { label: "1h", durationMs: 60 * 60 * 1000, interval: "1m" },
  { label: "6h", durationMs: 6 * 60 * 60 * 1000, interval: "5m" },
  { label: "24h", durationMs: 24 * 60 * 60 * 1000, interval: "15m" },
  { label: "7d", durationMs: 7 * 24 * 60 * 60 * 1000, interval: "1h" },
  { label: "30d", durationMs: 30 * 24 * 60 * 60 * 1000, interval: "6h" },
];

function presetToTimeRange(preset: TimeRangePreset): TimeRange {
  return {
    from: new Date(Date.now() - preset.durationMs),
    to: new Date(),
    interval: preset.interval,
    label: `Last ${preset.label}`,
  };
}

interface TimeRangeSelectorProps {
  value: TimeRange;
  onChange: (range: TimeRange) => void;
  presets?: TimeRangePreset[];
  showCustom?: boolean;
  className?: string;
}

export function TimeRangeSelector({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  showCustom = false,
  className,
}: TimeRangeSelectorProps): React.ReactElement {
  const activeKey =
    presets.find(
      (p) =>
        p.interval === value.interval &&
        Math.abs(Date.now() - value.from.getTime() - p.durationMs) < 60_000
    )?.label ?? "custom";

  return (
    <Tabs
      value={activeKey}
      onValueChange={(key) => {
        if (key === "custom") return;
        const preset = presets.find((p) => p.label === key);
        if (preset) {
          onChange(presetToTimeRange(preset));
        }
      }}
      className={cn("w-auto", className)}
    >
      <TabsList variant="line">
        {presets.map((preset) => (
          <TabsTrigger key={preset.label} value={preset.label}>
            {preset.label}
          </TabsTrigger>
        ))}
        {showCustom && <TabsTrigger value="custom">Custom</TabsTrigger>}
      </TabsList>
    </Tabs>
  );
}

export { DEFAULT_PRESETS, presetToTimeRange };
