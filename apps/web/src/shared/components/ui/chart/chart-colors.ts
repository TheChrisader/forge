export const CHART_COLORS = {
  primary: "hsl(241 64% 58%)",
  secondary: "hsl(227 43% 50%)",
  tertiary: "hsl(236 66% 46%)",
  quaternary: "hsl(244 55% 42%)",
  quinary: "hsl(243 49% 35%)",
} as const;

export type ChartColorName = keyof typeof CHART_COLORS;

export const METRIC_COLOR_MAP: Record<string, ChartColorName> = {
  cpu: "primary",
  memory: "secondary",
  network_rx: "tertiary",
  network_tx: "quaternary",
  block_io: "quinary",
  http_requests: "primary",
  http_errors: "quinary",
  http_duration: "secondary",
  builds: "tertiary",
  deployments: "quaternary",
  queue_depth: "primary",
  queue_throughput: "secondary",
};

const COLOR_KEYS = Object.keys(CHART_COLORS) as ChartColorName[];

export function getColorForMetric(metricName: string): string {
  const mapped = METRIC_COLOR_MAP[metricName];
  if (mapped) return CHART_COLORS[mapped];

  let hash = 0;
  for (let i = 0; i < metricName.length; i++) {
    hash = (hash * 31 + metricName.charCodeAt(i)) | 0;
  }

  return CHART_COLORS[COLOR_KEYS[Math.abs(hash) % COLOR_KEYS.length]];
}

export function getColorForSeries(index: number): string {
  return CHART_COLORS[COLOR_KEYS[index % COLOR_KEYS.length]];
}
