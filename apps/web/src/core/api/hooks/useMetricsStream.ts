import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SseClient } from "../streaming/sse-client";
import type { SSEConnectionState } from "../streaming/types";

interface UseMetricsStreamOptions {
  sourceId?: string;
  projectId?: string;
  platform?: boolean;
  enabled?: boolean;
}

interface MetricStreamPoint {
  metric: string;
  value: number;
  timestamp: string;
  unit?: string;
  labels?: Record<string, string>;
}

interface MetricStreamEvent {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  projectId: string | null;
  metrics: MetricStreamPoint[];
}

interface UseMetricsStreamReturn {
  latestValues: Map<string, MetricStreamPoint>;
  events: MetricStreamEvent[];
  isStreaming: boolean;
  connectionState: SSEConnectionState;
  error: Error | null;
}

const MAX_EVENTS = 100;
const MAX_LATEST_VALUES = 1000;

export function useMetricsStream(options: UseMetricsStreamOptions): UseMetricsStreamReturn {
  const { sourceId, projectId, platform, enabled: enabledProp } = options;

  const enabled = enabledProp ?? !!(sourceId || projectId || platform);
  const [latestValues, setLatestValues] = useState<Map<string, MetricStreamPoint>>(new Map());
  const [events, setEvents] = useState<MetricStreamEvent[]>([]);
  const [connectionState, setConnectionState] = useState<SSEConnectionState>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<SseClient | null>(null);

  const streamUrl = useMemo(() => {
    const baseUrl = import.meta.env.VITE_API_URL || window.location.origin;
    const params = new URLSearchParams();
    if (sourceId) params.set("sourceId", sourceId);
    if (projectId) params.set("projectId", projectId);
    if (platform) params.set("platform", "true");
    return `${baseUrl}/api/metrics/stream?${params.toString()}`;
  }, [sourceId, projectId, platform]);

  const handleEvent = useCallback((event: { event?: string; data: string }) => {
    if (event.event === "metric.data") {
      try {
        const parsed: MetricStreamEvent = JSON.parse(event.data) as MetricStreamEvent;

        setLatestValues((prev) => {
          const next = new Map(prev);
          for (const point of parsed.metrics) {
            next.set(`${parsed.sourceId}:${point.metric}`, point);
          }
          if (next.size > MAX_LATEST_VALUES) {
            const keys = Array.from(next.keys());
            for (let i = 0; i < keys.length - MAX_LATEST_VALUES; i++) {
              next.delete(keys[i]);
            }
          }
          return next;
        });

        setEvents((prev) => {
          const next = [...prev, parsed];
          return next.length > MAX_EVENTS ? next.slice(-MAX_EVENTS) : next;
        });
      } catch {
        // Malformed JSON — skip event
      }
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const client = new SseClient(streamUrl, {
      autoConnect: false,
      maxReconnectAttempts: 5,
      initialReconnectDelayMs: 1000,
      reconnectBackoffMultiplier: 2,
      maxReconnectDelayMs: 16000,
      connectionTimeoutMs: 30000,
      heartbeatTimeoutMs: 60000,
    });

    client.onMessage(handleEvent);

    client.onStateChange((state) => {
      setConnectionState(state);
      if (state === "error") {
        setError(new Error("SSE connection error"));
      } else if (state === "connected") {
        setError(null);
      }
    });

    clientRef.current = client;
    client.connect();

    return (): void => {
      client.close();
      clientRef.current = null;
      setConnectionState("disconnected");
    };
  }, [enabled, streamUrl, handleEvent]);

  const isStreaming = connectionState === "connected";

  return { latestValues, events, isStreaming, connectionState, error };
}
