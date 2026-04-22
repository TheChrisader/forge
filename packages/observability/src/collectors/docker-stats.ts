import type { ContainerStats } from "@forge/docker";
import type { MetricRecord } from "../types";

export interface DockerStatsInput {
  containerId: string;
  serviceId: string;
  serviceName: string;
  projectId: string;
  stats: ContainerStats;
  sourceType?: "SERVICE" | "CONTAINER";
}

export function collectDockerStats(input: DockerStatsInput): MetricRecord[] {
  const { serviceId, serviceName, projectId, stats, sourceType = "SERVICE" } = input;

  return [
    {
      sourceType,
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "cpu_usage_percent",
      value: stats.cpu.usage,
      unit: "percent",
      projectId,
      serviceId,
    },
    {
      sourceType: "SERVICE",
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "memory_usage_bytes",
      value: stats.memory.usage,
      unit: "bytes",
      projectId,
      serviceId,
    },
    {
      sourceType: "SERVICE",
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "memory_usage_percent",
      value: stats.memory.percentage,
      unit: "percent",
      projectId,
      serviceId,
    },
    {
      sourceType: "SERVICE",
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "network_rx_bytes",
      value: stats.network.rxBytes,
      unit: "bytes",
      projectId,
      serviceId,
    },
    {
      sourceType: "SERVICE",
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "network_tx_bytes",
      value: stats.network.txBytes,
      unit: "bytes",
      projectId,
      serviceId,
    },
    {
      sourceType: "SERVICE",
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "block_io_read_bytes",
      value: stats.blockIO.readBytes,
      unit: "bytes",
      projectId,
      serviceId,
    },
    {
      sourceType: "SERVICE",
      sourceId: serviceId,
      sourceName: serviceName,
      metric: "block_io_write_bytes",
      value: stats.blockIO.writeBytes,
      unit: "bytes",
      projectId,
      serviceId,
    },
  ];
}
