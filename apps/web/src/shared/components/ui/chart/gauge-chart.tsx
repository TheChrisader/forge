import { cn } from "@/shared/lib/utils";
import { getGaugeColor } from "@/features/metrics/lib/metric-colors";
import { formatNumber } from "@/features/metrics/lib/metric-formatters";

interface GaugeChartProps {
  value: number;
  max?: number;
  label?: string;
  unit?: string;
  thresholds?: {
    warning?: number;
    critical?: number;
  };
  size?: number;
  showValue?: boolean;
  className?: string;
}

const ARC_SWEEP = 270;
const GAP = 360 - ARC_SWEEP;
const GAP_START = 90 + GAP / 2;
const RADIUS_RATIO = 0.8;
const STROKE_WIDTH_RATIO = 0.12;

export function GaugeChart({
  value,
  max = 100,
  label,
  unit,
  thresholds,
  size = 120,
  showValue = true,
  className,
}: GaugeChartProps): React.ReactElement | null {
  const clampedValue = Math.max(0, Math.min(value, max));
  const fraction = max > 0 ? clampedValue / max : 0;

  const radius = (size * RADIUS_RATIO) / 2;
  const strokeWidth = size * STROKE_WIDTH_RATIO;
  const circumference = (ARC_SWEEP / 360) * 2 * Math.PI * radius;
  const foregroundLength = fraction * circumference;

  const warning = thresholds?.warning ?? 60;
  const critical = thresholds?.critical ?? 80;
  const color = getGaugeColor(clampedValue, warning, critical);

  const displayValue = max === 100 ? clampedValue : clampedValue;
  const formattedValue = formatNumber(displayValue);

  return (
    <div className={cn("inline-flex flex-col items-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="transform rotate-0"
      >
        {/* Background arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${circumference} ${2 * Math.PI * radius}`}
          strokeDashoffset="0"
          transform={`rotate(${GAP_START} ${size / 2} ${size / 2})`}
        />
        {/* Foreground arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${foregroundLength} ${2 * Math.PI * radius}`}
          strokeDashoffset="0"
          transform={`rotate(${GAP_START} ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dasharray 0.6s ease-in-out, stroke 0.3s ease" }}
        />
        {/* Center value text */}
        {showValue && (
          <text
            x={size / 2}
            y={size / 2 - (label ? 4 : 0)}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono"
            fill="hsl(var(--foreground))"
            fontSize={size * 0.22}
            fontWeight={600}
          >
            {formattedValue}
            {unit}
          </text>
        )}
      </svg>
      {label && <span className="font-sans text-muted-foreground mt-1 text-xs">{label}</span>}
    </div>
  );
}
