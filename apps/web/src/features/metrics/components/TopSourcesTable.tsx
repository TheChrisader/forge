import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Progress } from "@/shared/components/ui/progress";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { usePlatformSummary } from "@/core/api/hooks/useMetrics";
import { formatBytes, formatPercent } from "../lib/metric-formatters";
import { ArrowUpDown, ExternalLink } from "lucide-react";

type SortField = "cpu" | "memory";
type SortDir = "asc" | "desc";

export function TopSourcesTable(): React.ReactElement {
  const summary = usePlatformSummary();
  const [sortField, setSortField] = useState<SortField>("cpu");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sources = useMemo(() => {
    if (!summary.data) return [];

    const cpuMap = new Map<string, { value: number; unit: string | null }>();
    for (const entry of summary.data.topSourcesByCpu) {
      const cpuMetric = entry.metrics.find((m) => m.metric === "cpu_usage_percent");
      if (cpuMetric) {
        cpuMap.set(entry.sourceId, { value: cpuMetric.value, unit: cpuMetric.unit });
      }
    }

    const memoryMap = new Map<string, { value: number; unit: string | null }>();
    for (const entry of summary.data.topSourcesByMemory) {
      const memMetric = entry.metrics.find((m) => m.metric === "memory_usage_bytes");
      if (memMetric) {
        memoryMap.set(entry.sourceId, { value: memMetric.value, unit: memMetric.unit });
      }
    }

    const allIds = new Set([
      ...summary.data.topSourcesByCpu.map((s) => s.sourceId),
      ...summary.data.topSourcesByMemory.map((s) => s.sourceId),
    ]);

    return Array.from(allIds)
      .map((id) => {
        const cpu = cpuMap.get(id);
        const mem = memoryMap.get(id);
        const cpuSource = summary.data.topSourcesByCpu.find((s) => s.sourceId === id);
        const memSource = summary.data.topSourcesByMemory.find((s) => s.sourceId === id);
        const source = cpuSource ?? memSource!;
        return {
          sourceId: id,
          sourceName: source.sourceName,
          sourceType: source.sourceType,
          cpu: cpu?.value ?? 0,
          cpuUnit: cpu?.unit,
          memory: mem?.value ?? 0,
          memoryUnit: mem?.unit,
        };
      })
      .sort((a, b) => {
        const aVal = sortField === "cpu" ? a.cpu : a.memory;
        const bVal = sortField === "cpu" ? b.cpu : b.memory;
        return sortDir === "desc" ? bVal - aVal : aVal - bVal;
      })
      .slice(0, 10);
  }, [summary.data, sortField, sortDir]);

  function toggleSort(field: SortField): void {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  if (summary.isLoading) {
    return (
      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold">Top Sources</h3>
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (!sources.length) {
    return (
      <div className="space-y-3">
        <h3 className="font-serif text-lg font-semibold">Top Sources</h3>
        <p className="font-mono text-xs text-muted-foreground">
          No source data available for this time range.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-serif text-lg font-semibold">Top Sources</h3>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Source</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => toggleSort("cpu")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                CPU
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => toggleSort("memory")}
                className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
              >
                Memory
                <ArrowUpDown className="h-3 w-3" />
              </button>
            </TableHead>
            <TableHead className="w-15" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {sources.map((source) => (
            <TableRow key={source.sourceId}>
              <TableCell className="font-mono text-xs">{source.sourceName}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {source.sourceType}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Progress value={Math.min(source.cpu, 100)} className="h-2 w-16" />
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatPercent(source.cpu, 0)}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatBytes(source.memory, 0)}
                </span>
              </TableCell>
              <TableCell>
                <Link
                  to="/metrics/source/$sourceType/$sourceId"
                  params={{
                    sourceType: source.sourceType.toLowerCase(),
                    sourceId: source.sourceId,
                  }}
                  className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
