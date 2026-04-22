import { cn } from "@/shared/lib/utils";
import { CHART_COLORS } from "./chart-colors";

interface SparklineChartProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  showArea?: boolean;
  strokeWidth?: number;
  className?: string;
}

function buildSmoothPath(points: [number, number][]): string {
  if (points.length < 2) return "";

  const [first, ...rest] = points;
  let d = `M${first[0]},${first[1]}`;

  for (let i = 0; i < rest.length; i++) {
    const prev = points[i];
    const curr = rest[i];
    const cpX = (prev[0] + curr[0]) / 2;
    d += ` C${cpX},${prev[1]} ${cpX},${curr[1]} ${curr[0]},${curr[1]}`;
  }

  return d;
}

export function SparklineChart({
  data,
  color = CHART_COLORS.primary,
  width = 100,
  height = 32,
  showArea = true,
  strokeWidth = 1.5,
  className,
}: SparklineChartProps): React.ReactElement | null {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points: [number, number][] = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return [x, y];
  });

  const linePath = buildSmoothPath(points);

  let areaPath = "";
  if (showArea) {
    areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      className={cn("overflow-visible", className)}
      preserveAspectRatio="none"
    >
      {showArea && <path d={areaPath} fill={color} fillOpacity={0.1} stroke="none" />}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
