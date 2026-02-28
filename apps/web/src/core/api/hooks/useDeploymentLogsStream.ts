/**
 * useDeploymentLogsStream Hook
 *
 * Custom React hook for streaming deployment logs via Server-Sent Events (SSE).
 * Replaces polling-based log fetching with real-time streaming.
 *
 * Features:
 * - Creates EventSource connection to SSE endpoint
 * - Handles authentication via token query param
 * - Maintains logs as an array of formatted strings
 * - Auto-reconnects with exponential backoff on failure
 * - Cleans up connection on unmount
 */

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Deployment log entry structure from SSE events
 */
interface SSEDeploymentLogEntry {
  lineNumber: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  stage?: string;
  progress?: number;
}

/**
 * SSE event types from the server
 */
type SSEEventType = "connected" | "log" | "progress" | "completed" | "error";

/**
 * SSE message structure
 */
interface SSEMessage {
  event?: SSEEventType;
  data:
    | SSEDeploymentLogEntry
    | { deploymentId: string; timestamp: string }
    | { status: string }
    | { message: string };
}

/**
 * Hook return value
 */
interface UseDeploymentLogsStreamResult {
  /** Array of formatted log lines */
  logs: string[];
  /** Whether the SSE connection is currently active */
  isConnected: boolean;
  /** Connection error, if any */
  error: Error | null;
  /** Build progress percentage (0-100), if available */
  progress: number | undefined;
  /** Deployment status */
  status: "connecting" | "connected" | "completed" | "error" | "disconnected";
}

/**
 * Format a log entry as a string
 */
function formatLogLine(entry: SSEDeploymentLogEntry): string {
  return `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}`;
}

/**
 * Get auth token from localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }

  try {
    return localStorage.getItem("auth_token");
  } catch (error) {
    console.warn("Failed to access localStorage:", error);
    return null;
  }
}

/**
 * Hook for streaming deployment logs via SSE
 *
 * @param deploymentId - The deployment ID to stream logs for
 * @returns Logs, connection state, error, progress, and status
 */
export function useDeploymentLogsStream(deploymentId: string): UseDeploymentLogsStreamResult {
  const [logs, setLogs] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<
    "connecting" | "connected" | "completed" | "error" | "disconnected"
  >("connecting");

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    // Clean up any existing connection
    cleanup();

    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const token = getAuthToken();

    // Build URL with auth token as query param
    const url = new URL(`/api/deployments/${deploymentId}/logs/stream`, baseUrl);
    if (token) {
      url.searchParams.set("token", token);
    }

    setStatus("connecting");
    setError(null);

    const eventSource = new EventSource(url.toString());
    eventSourceRef.current = eventSource;

    // Connection opened
    eventSource.onopen = (): void => {
      setIsConnected(true);
      setStatus("connected");
      reconnectAttemptsRef.current = 0;
    };

    // Handle incoming messages
    eventSource.onmessage = (event: MessageEvent): void => {
      try {
        const message = JSON.parse(event.data as string) as SSEMessage;

        switch (message.event) {
          case "connected": {
            // Initial connection confirmation
            console.error("SSE connected:", message.data);
            break;
          }

          case "log": {
            // New log entry
            const logEntry = message.data as SSEDeploymentLogEntry;
            setLogs((prev) => [...prev, formatLogLine(logEntry)]);

            // Update progress if available
            if (logEntry.progress !== undefined) {
              setProgress(logEntry.progress);
            }
            break;
          }

          case "progress": {
            // Progress update (separate event type)
            const progressData = message.data as { progress?: number };
            if (progressData.progress !== undefined) {
              setProgress(progressData.progress);
            }
            break;
          }

          case "completed": {
            // Build completed successfully
            setStatus("completed");
            setProgress(100);
            setIsConnected(false);
            cleanup();
            break;
          }

          case "error": {
            // Build failed
            setError(new Error((message.data as { message: string }).message));
            setStatus("error");
            setIsConnected(false);
            cleanup();
            break;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError, event.data);
      }
    };

    // Handle connection errors
    eventSource.onerror = (eventError: Event): void => {
      console.error("SSE connection error:", eventError);

      // EventSource automatically tries to reconnect, but we add exponential backoff
      const attempt = reconnectAttemptsRef.current + 1;
      reconnectAttemptsRef.current = attempt;

      if (attempt > 5) {
        // Give up after 5 attempts
        setError(new Error("Failed to connect to log stream after multiple attempts"));
        setStatus("error");
        setIsConnected(false);
        cleanup();
        return;
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 16000);

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };
  }, [deploymentId, cleanup]);

  useEffect((): void | (() => void) => {
    if (!deploymentId) {
      return;
    }

    connect();

    return (): void => {
      cleanup();
    };
  }, [deploymentId, connect, cleanup]);

  return {
    logs,
    isConnected,
    error,
    progress,
    status,
  };
}
