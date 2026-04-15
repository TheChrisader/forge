import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deploymentsApi } from "../clients/deployments";
import type { Deployment, DeploymentWithRelations } from "@forge/types";
import { useState, useEffect, useCallback, useRef } from "react";
import { SseClient } from "../streaming/sse-client";
import type { SSEConnectionState } from "../streaming/types";

export const deploymentKeys = {
  all: ["deployments"] as const,
  lists: () => [...deploymentKeys.all, "list"] as const,
  list: (filters?: object) => [...deploymentKeys.lists(), filters] as const,
  details: () => [...deploymentKeys.all, "detail"] as const,
  detail: (id: string) => [...deploymentKeys.details(), id] as const,
  logs: (id: string) => [...deploymentKeys.detail(id), "logs"] as const,
  byProject: (projectId: string) => [...deploymentKeys.all, "project", projectId] as const,
};

export function useDeployments(params?: {
  projectId?: string;
  status?: string[];
  page?: number;
  limit?: number;
}): ReturnType<typeof useQuery> {
  return useQuery({
    queryKey: deploymentKeys.list(params),
    queryFn: () => deploymentsApi.getAll(params),
  });
}

export function useProjectDeployments(
  projectId: string
): ReturnType<typeof useQuery<Deployment[]>> {
  return useQuery<Deployment[]>({
    queryKey: deploymentKeys.byProject(projectId),
    queryFn: async () => {
      const response = await deploymentsApi.getByProject(projectId);
      return response.data;
    },
    enabled: !!projectId,
    refetchInterval: 2000,
  });
}

export function useProjectDeploymentsWithFilters(
  projectId: string,
  filters?: {
    status?: string[];
    strategy?: string;
    search?: string;
    page?: number;
    limit?: number;
  }
): ReturnType<
  typeof useQuery<{
    data: Deployment[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }>
> {
  return useQuery({
    queryKey: [...deploymentKeys.byProject(projectId), filters],
    queryFn: () => deploymentsApi.getAll({ projectId, ...filters }),
    enabled: !!projectId,
    refetchInterval: 2000,
  });
}

export function useDeployment(
  deploymentId: string
): ReturnType<typeof useQuery<DeploymentWithRelations>> {
  return useQuery<DeploymentWithRelations>({
    queryKey: deploymentKeys.detail(deploymentId),
    queryFn: async () => {
      const response = await deploymentsApi.getById(deploymentId);
      return response.data;
    },
    enabled: !!deploymentId,
    refetchInterval: 2000,
  });
}

export function useCreateDeployment(): ReturnType<
  typeof useMutation<
    Deployment,
    unknown,
    {
      projectId: string;
      gitBranch?: string;
      gitCommit?: string;
      buildArgs?: Record<string, string>;
    }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      gitBranch,
      gitCommit,
      buildArgs,
    }: {
      projectId: string;
      gitBranch?: string;
      gitCommit?: string;
      buildArgs?: Record<string, string>;
    }) => {
      const response = await deploymentsApi.create(projectId, {
        gitBranch,
        gitCommit,
        buildArgs,
      });
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: deploymentKeys.byProject(projectId) });
      void queryClient.invalidateQueries({ queryKey: deploymentKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
  });
}

export function useCancelDeployment(): ReturnType<typeof useMutation<Deployment, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deploymentId: string) => {
      const response = await deploymentsApi.cancel(deploymentId);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: deploymentKeys.all });
    },
  });
}

// =============================================================================
// Deployment Logs - Historical + Streaming
// =============================================================================

/**
 * Deployment log entry structure - normalized format used by the hook
 */
export interface DeploymentLogEntry {
  lineNumber: number;
  timestamp: string;
  level: string;
  source: string;
  message: string;
  stage?: string;
  progress?: number;
}

/**
 * Return value for useDeploymentLogs hook
 */
export interface UseDeploymentLogsResult {
  /** Array of log entries */
  logs: DeploymentLogEntry[];
  /** Whether historical logs are currently loading */
  isLoading: boolean;
  /** Whether SSE streaming is currently active */
  isStreaming: boolean;
  /** Error from either historical fetch or SSE connection */
  error: Error | null;
  /** Build progress percentage (0-100), if available */
  progress: number | undefined;
  /** Total number of log lines available */
  total: number;
}

/**
 * SSE event types from the server
 */
type SSEEventType = "connected" | "log" | "progress" | "completed" | "error" | "timeout";

/**
 * SSE message data (event type comes from SSE event field, not JSON)
 */
type SSEMessageData =
  | DeploymentLogEntry
  | { deploymentId: string; timestamp: string }
  | { status: string }
  | { message: string }
  | { progress?: number };

/**
 * Active deployment statuses that should trigger SSE streaming
 */
const ACTIVE_STATUSES = new Set(["PENDING", "QUEUED", "BUILDING", "DEPLOYING", "ROLLBACK"]);

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
 * Map SSE connection state to determine if streaming is active
 */
function isStreamingState(state: SSEConnectionState): boolean {
  return state === "connecting" || state === "connected";
}

/**
 * Hook for fetching deployment logs (historical + streaming)
 *
 * This hook:
 * 1. Fetches the last 500 lines of historical logs on mount
 * 2. Determines if streaming is needed based on deployment status
 * 3. Sets up SSE connection for active deployments
 * 4. Deduplicates logs using lineNumber to avoid duplicates between historical and streaming
 * 5. Applies memory limit (1000 lines) to prevent memory issues
 *
 * @param deploymentId - The deployment ID to fetch logs for
 * @returns Logs, loading states, error, progress, and total count
 */
export function useDeploymentLogs(deploymentId: string): UseDeploymentLogsResult {
  const [logs, setLogs] = useState<DeploymentLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [total, setTotal] = useState(0);

  // Refs for SSE management
  const clientRef = useRef<SseClient | null>(null);
  const maxLineRef = useRef(0);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);

  /**
   * Add a log entry with truncation to prevent memory issues
   * CRITICAL: Guards against updates after unmount or completion
   */
  const addLog = useCallback((entry: DeploymentLogEntry) => {
    // Don't update if unmounted or completed
    if (!mountedRef.current || completedRef.current) return;

    setLogs((prev) => {
      const newLogs = [...prev, entry];
      // Keep only the last 1000 logs to prevent memory issues
      if (newLogs.length > 1000) {
        return newLogs.slice(-1000);
      }
      return newLogs;
    });
  }, []);

  /**
   * Fetch historical logs
   */
  const fetchHistoricalLogs = useCallback(async (): Promise<{
    status: Deployment["status"] | null;
  }> => {
    try {
      setIsLoading(true);
      const response = await deploymentsApi.getLogs(deploymentId, { tail: 500 });

      // Convert timestamp to ISO string format for consistency
      const formattedLogs = response.logs.map((log) => ({
        lineNumber: log.lineNumber,
        timestamp: new Date(log.timestamp).toISOString(),
        level: log.level,
        source: log.source,
        message: log.message,
      }));

      setLogs(formattedLogs);
      setTotal(response.total);

      // Track max line number for stream deduplication
      if (formattedLogs.length > 0) {
        maxLineRef.current = formattedLogs[formattedLogs.length - 1].lineNumber;
      }

      // Fetch deployment status to determine if we need streaming
      try {
        const deploymentResponse = await deploymentsApi.getById(deploymentId);
        return { status: deploymentResponse.data.status };
      } catch {
        // If we can't fetch status, assume historical only
        return { status: null };
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Failed to fetch logs");
      setError(errorObj);
      return { status: null };
    } finally {
      setIsLoading(false);
    }
  }, [deploymentId]);

  /**
   * Setup SSE connection for active deployments
   */
  const setupStreaming = useCallback(() => {
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
            // New log entry - deduplicate using lineNumber
            const logEntry = data as DeploymentLogEntry;
            if (logEntry.lineNumber > maxLineRef.current) {
              addLog(logEntry);
              maxLineRef.current = logEntry.lineNumber;
            }

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
            setIsStreaming(false);
            setProgress(100);
            client.close();
            break;
          }

          case "error":
          case "timeout": {
            // Build failed or timed out
            completedRef.current = true;
            const errorMsg = (data as { message: string }).message;
            setError(new Error(errorMsg));
            setIsStreaming(false);
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

      setIsStreaming(false);
    });

    /**
     * State change handler - maps SSE states to streaming state
     */
    client.onStateChange((state) => {
      // Don't update if unmounted or completed
      if (!mountedRef.current || completedRef.current) return;

      setIsStreaming(isStreamingState(state));
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
    setIsStreaming(false);
  }, []);

  /**
   * Main effect: fetch historical logs first, then determine if streaming needed
   */
  useEffect(() => {
    if (!deploymentId) return;

    mountedRef.current = true;

    // Fetch historical logs and get deployment status
    void fetchHistoricalLogs().then(({ status }: { status: Deployment["status"] | null }) => {
      if (!mountedRef.current) return;

      // Setup streaming if deployment is still active
      if (status && ACTIVE_STATUSES.has(status)) {
        setupStreaming();
      }
    });

    return (): void => {
      mountedRef.current = false;
      cleanup();
    };
  }, [deploymentId, fetchHistoricalLogs, setupStreaming, cleanup]);

  return {
    logs,
    isLoading,
    isStreaming,
    error,
    progress,
    total,
  };
}
