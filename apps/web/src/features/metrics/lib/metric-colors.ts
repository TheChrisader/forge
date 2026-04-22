import { CHART_COLORS, getColorForMetric } from "@/shared/components/ui/chart/chart-colors";

const MUTED_FOREGROUND = "hsl(220 8% 46%)";
const DESTRUCTIVE = "hsl(0 86% 61%)";
const SUCCESS = "hsl(142 71% 45%)";
const WARNING = "hsl(38 92% 50%)";

export function getColorsForMetrics(metricNames: string[]): string[] {
  return metricNames.map(getColorForMetric);
}

export function getCpuMemoryColors(): { cpu: string; memory: string } {
  return {
    cpu: CHART_COLORS.primary,
    memory: CHART_COLORS.secondary,
  };
}

export function getNetworkColors(): { rx: string; tx: string } {
  return {
    rx: CHART_COLORS.tertiary,
    tx: CHART_COLORS.quaternary,
  };
}

export function getHttpColors(): { requests: string; errors: string; duration: string } {
  return {
    requests: CHART_COLORS.primary,
    errors: CHART_COLORS.quinary,
    duration: CHART_COLORS.secondary,
  };
}

export function getTrendColor(
  direction: "up" | "down" | "flat",
  semantics: "positive-is-good" | "negative-is-good" | "neutral"
): string {
  if (direction === "flat") return MUTED_FOREGROUND;
  if (semantics === "neutral") return MUTED_FOREGROUND;

  const isPositive = direction === "up";
  const isGood = semantics === "positive-is-good" ? isPositive : !isPositive;

  return isGood ? SUCCESS : DESTRUCTIVE;
}

export function getGaugeColor(value: number, warning = 60, critical = 80): string {
  if (value >= critical) return DESTRUCTIVE;
  if (value >= warning) return WARNING;
  return CHART_COLORS.primary;
}
