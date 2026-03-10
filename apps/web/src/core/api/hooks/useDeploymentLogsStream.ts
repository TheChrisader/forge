/**
 * useDeploymentLogsStream Hook
 *
 * Custom React hook for streaming deployment logs via Server-Sent Events (SSE).
 * Uses fetch-based SseClient which supports custom HTTP headers for authentication.
 *
 * Features:
 * - Creates SseClient connection to SSE endpoint with Authorization header
 * - Maintains logs as an array of formatted strings with memory management
 * - Auto-reconnects with exponential backoff and jitter on failure
 * - Tracks Last-Event-ID for event replay on reconnection
 * - Proper cleanup on unmount and completion
 * - Guards against state updates after unmount/completion
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { SseClient } from "../streaming/sse-client";
import type { SSEConnectionState } from "../streaming/types";

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
type SSEEventType = "connected" | "log" | "progress" | "completed" | "error" | "timeout";

/**
 * SSE message data (event type comes from SSE event field, not JSON)
 */
type SSEMessageData =
  | SSEDeploymentLogEntry
  | { deploymentId: string; timestamp: string }
  | { status: string }
  | { message: string }
  | { progress?: number };

/**
 * Hook return value
 */
export interface UseDeploymentLogsStreamResult {
  /** Array of structured log entries */
  logs: SSEDeploymentLogEntry[];
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
 * Map SSE connection state to hook status
 */
function mapSSEStateToStatus(state: SSEConnectionState): UseDeploymentLogsStreamResult["status"] {
  switch (state) {
    case "connecting":
      return "connecting";
    case "connected":
      return "connected";
    case "disconnected":
      return "disconnected";
    case "error":
    case "closed":
      return "error";
  }
}

/**
 * Hook for streaming deployment logs via SSE
 *
 * @param deploymentId - The deployment ID to stream logs for
 * @param options - Configuration options
 * @returns Logs, connection state, error, progress, and status
 */
export function useDeploymentLogsStream(
  deploymentId: string,
  options: { maxLogs?: number } = {}
): UseDeploymentLogsStreamResult {
  const { maxLogs = 1000 } = options;

  const [logs, setLogs] = useState<SSEDeploymentLogEntry[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [status, setStatus] = useState<UseDeploymentLogsStreamResult["status"]>("connecting");

  // Refs for tracking state across renders
  const clientRef = useRef<SseClient | null>(null);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);

  /**
   * Add a log entry with truncation to prevent memory issues
   * CRITICAL: Guards against updates after unmount or completion
   */
  const addLog = useCallback(
    (entry: SSEDeploymentLogEntry) => {
      // Don't update if unmounted or completed
      if (!mountedRef.current || completedRef.current) return;

      setLogs((prev) => {
        const newLogs = [...prev, entry];
        if (maxLogs > 0 && newLogs.length > maxLogs) {
          return newLogs.slice(-maxLogs);
        }
        return newLogs;
      });
    },
    [maxLogs]
  );

  /**
   * Setup SSE connection with SseClient
   */
  const setupConnection = useCallback(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const token = getAuthToken();
    const url = `${baseUrl}/api/deployments/${deploymentId}/logs/stream`;

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const client = new SseClient(url, {
      autoConnect: false,
      headers,
      maxReconnectAttempts: 5,
      initialReconnectDelayMs: 1000,
      reconnectBackoffMultiplier: 2,
      maxReconnectDelayMs: 16000,
    });

    /**
     * Message handler - processes incoming SSE events
     */
    client.onMessage((event) => {
      // Don't process if unmounted or completed
      if (!mountedRef.current || completedRef.current) return;

      try {
        const eventType = event.event as SSEEventType;
        const data = JSON.parse(event.data) as SSEMessageData;

        switch (eventType) {
          case "connected":
            // Initial connection confirmation - no action needed
            break;

          case "log": {
            // New log entry
            const logEntry = data as SSEDeploymentLogEntry;
            addLog(logEntry);

            // Update progress if available
            if (logEntry.progress !== undefined) {
              setProgress(logEntry.progress);
            }
            break;
          }

          case "progress": {
            // Progress update (separate event type)
            const progressData = data as { progress?: number };
            if (progressData.progress !== undefined) {
              setProgress(progressData.progress);
            }
            break;
          }

          case "completed": {
            // Build completed successfully
            completedRef.current = true;
            setStatus("completed");
            setProgress(100);
            setIsConnected(false);
            client.close();
            break;
          }

          case "error":
          case "timeout": {
            // Build failed or timed out
            completedRef.current = true;
            const errorMsg = (data as { message: string }).message;
            setError(new Error(errorMsg));
            setStatus("error");
            setIsConnected(false);
            client.close();
            break;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError, event.data);
      }
    });

    /**
     * Error handler - handles connection errors
     */
    client.onError((err) => {
      // Don't update if unmounted or completed
      if (!mountedRef.current || completedRef.current) return;

      console.error("SSE error:", err);

      if (err.code === "CONNECTION_LIMIT_REACHED") {
        const details = err.details as { type: string; limit: number; current: number };
        setError(
          new Error(
            `Connection limit reached (${details.type}: ${details.current}/${details.limit})`
          )
        );
      } else {
        setError(new Error(err.message));
      }

      setStatus("error");
      setIsConnected(false);
    });

    /**
     * State change handler - maps SSE states to hook status
     */
    client.onStateChange((state) => {
      // Don't update if unmounted or completed
      if (!mountedRef.current || completedRef.current) return;

      const newStatus = mapSSEStateToStatus(state);
      setStatus(newStatus);
      setIsConnected(state === "connected");
    });

    clientRef.current = client;
    client.connect();
  }, [deploymentId, addLog]);

  /**
   * Cleanup function
   */
  const cleanup = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }
    completedRef.current = false;
  }, []);

  /**
   * Effect - setup connection on mount, cleanup on unmount
   */
  useEffect((): void | (() => void) => {
    if (!deploymentId) return;

    mountedRef.current = true;
    setupConnection();

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [deploymentId, setupConnection, cleanup]);

  return {
    logs,
    isConnected,
    error,
    progress,
    status,
  };
}
