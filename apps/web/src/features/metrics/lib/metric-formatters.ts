const BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB"] as const;

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return `0 ${BYTE_UNITS[0]}`;
  const exponent = Math.min(
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)),
    BYTE_UNITS.length - 1
  );
  const value = bytes / Math.pow(1024, exponent);
  const formatted = value.toFixed(decimals).replace(/\.0+$/, "");
  return `${formatted} ${BYTE_UNITS[exponent]}`;
}

export function formatPercent(value: number, decimals = 1): string {
  return `${value.toFixed(decimals).replace(/\.0+$/, "")}%`;
}

export function formatDuration(seconds: number): string {
  const abs = Math.abs(seconds);
  if (abs < 1) return `${Math.round(seconds * 1000)}ms`;
  if (abs < 60) return `${seconds.toFixed(1).replace(/\.0+$/, "")}s`;
  const min = Math.floor(abs / 60);
  const sec = Math.round(abs % 60);
  return `${min}m ${sec}s`;
}

export function formatCount(count: number): string {
  if (Math.abs(count) >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1).replace(/\.0+$/, "")}M`;
  }
  if (Math.abs(count) >= 1_000) {
    return `${(count / 1_000).toFixed(1).replace(/\.0+$/, "")}k`;
  }
  return String(count);
}

export function formatRate(value: number, unit = ""): string {
  const formatted = formatCount(value);
  return unit ? `${formatted}/${unit}` : `${formatted}/s`;
}

export function formatNumber(value: number, decimals?: number): string {
  if (decimals !== undefined) {
    return value.toFixed(decimals).replace(/\.0+$/, "");
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.0+$/, "");
}

export function formatMetricValue(value: number, unit: string): string {
  switch (unit) {
    case "percent":
      return formatPercent(value);
    case "bytes":
      return formatBytes(value);
    case "seconds":
      return formatDuration(value);
    case "count":
      return formatCount(value);
    case "count/sec":
      return formatRate(value);
    case "status":
      return value === 1 ? "Healthy" : "Unhealthy";
    default:
      return formatNumber(value);
  }
}
