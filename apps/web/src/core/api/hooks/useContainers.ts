import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { containersApi } from "../clients/containers";
import type { DockerContainer, ContainerStats, ContainerLogEntry } from "@forge/types";
import { useState, useEffect, useCallback, useRef } from "react";
import { SseClient } from "../streaming/sse-client";

export const containerKeys = {
  all: ["containers"] as const,
  lists: () => [...containerKeys.all, "list"] as const,
  details: () => [...containerKeys.all, "detail"] as const,
  detail: (id: string) => [...containerKeys.details(), id] as const,
  logs: (id: string) => [...containerKeys.detail(id), "logs"] as const,
  stats: (id: string) => [...containerKeys.detail(id), "stats"] as const,
  byProject: (projectId: string) => [...containerKeys.all, "project", projectId] as const,
  byDeployment: (deploymentId: string) =>
    [...containerKeys.all, "deployment", deploymentId] as const,
};

/**
 * Hook to get all containers for a project
 */
export function useProjectContainers(
  projectId: string,
  options?: { includeTerminated?: boolean }
): ReturnType<typeof useQuery<DockerContainer[]>> {
  return useQuery<DockerContainer[]>({
    queryKey: [...containerKeys.byProject(projectId), options],
    queryFn: async () => {
      const response = await containersApi.getByProject(projectId, options);
      return response.data;
    },
    enabled: !!projectId,
    refetchInterval: 5000,
  });
}

/**
 * Hook to get all containers for a deployment
 */
export function useDeploymentContainers(
  deploymentId: string
): ReturnType<typeof useQuery<DockerContainer[]>> {
  return useQuery<DockerContainer[]>({
    queryKey: containerKeys.byDeployment(deploymentId),
    queryFn: async () => {
      const response = await containersApi.getByDeployment(deploymentId);
      return response.data;
    },
    enabled: !!deploymentId,
    refetchInterval: 5000,
  });
}

/**
 * Hook to get a single container by ID
 */
export function useContainer(containerId: string): ReturnType<typeof useQuery<DockerContainer>> {
  return useQuery<DockerContainer>({
    queryKey: containerKeys.detail(containerId),
    queryFn: async () => {
      const response = await containersApi.getById(containerId);
      return response.data;
    },
    enabled: !!containerId,
    refetchInterval: 5000,
  });
}

/**
 * Hook to get container logs with streaming support
 *
 * This hook:
 * 1. Fetches historical logs on mount
 * 2. Checks if container is running
 * 3. Sets up SSE streaming for running containers
 * 4. Deduplicates logs using lineNumber
 *
 * @param containerId - The container ID to fetch logs for
 * @returns Logs, loading states, error, and streaming status
 */
export function useContainerLogs(containerId: string): {
  logs: ContainerLogEntry[];
  isLoading: boolean;
  isStreaming: boolean;
  error: Error | null;
} {
  const [logs, setLogs] = useState<ContainerLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef<SseClient | null>(null);
  const maxLineRef = useRef(0);
  const completedRef = useRef(false);
  const mountedRef = useRef(true);

  // Fetch container to check if running
  const { data: container } = useQuery({
    queryKey: ["container", containerId],
    queryFn: async () => {
      const response = await containersApi.getById(containerId);
      return response.data;
    },
    enabled: !!containerId,
    refetchInterval: 5000,
  });

  // Fetch historical logs
  const fetchHistoricalLogs = useCallback(async (): Promise<void> => {
    try {
      setIsLoading(true);
      const response = await containersApi.getLogs(containerId, { tail: 500 });

      setLogs(response.data);
      if (response.data.length > 0) {
        maxLineRef.current = response.data[response.data.length - 1].lineNumber;
      }
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error("Failed to fetch logs");
      setError(errorObj);
    } finally {
      setIsLoading(false);
    }
  }, [containerId]);

  // Get auth token from localStorage
  const getAuthToken = useCallback((): string | null => {
    if (typeof window === "undefined" || typeof localStorage === "undefined") {
      return null;
    }
    try {
      return localStorage.getItem("auth_token");
    } catch {
      return null;
    }
  }, []);

  // Setup SSE connection
  const setupStreaming = useCallback(() => {
    const baseUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
    const token = getAuthToken();
    const url = `${baseUrl}/api/containers/${containerId}/logs/stream`;

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

    client.onMessage((event) => {
      if (!mountedRef.current || completedRef.current) return;

      try {
        const eventType = event.event;
        const data = JSON.parse(event.data) as ContainerLogEntry;

        switch (eventType) {
          case "connected": {
            // Connection established
            break;
          }
          case "log": {
            const logEntry = data;
            if (logEntry.lineNumber > maxLineRef.current) {
              setLogs((prev) => {
                const newLogs = [...prev, logEntry];
                if (newLogs.length > 1000) {
                  return newLogs.slice(-1000);
                }
                return newLogs;
              });
              maxLineRef.current = logEntry.lineNumber;
            }
            break;
          }
          case "completed": {
            completedRef.current = true;
            setIsStreaming(false);
            client.close();
            break;
          }
          case "error": {
            completedRef.current = true;
            setError(new Error(data.message));
            setIsStreaming(false);
            client.close();
            break;
          }
        }
      } catch (parseError) {
        console.error("Failed to parse SSE message:", parseError);
      }
    });

    client.onError((err) => {
      if (!mountedRef.current || completedRef.current) return;
      console.error("SSE error:", err);
      setError(new Error(err.message));
      setIsStreaming(false);
    });

    client.onStateChange((state) => {
      if (!mountedRef.current || completedRef.current) return;
      setIsStreaming(state === "connected");
    });

    clientRef.current = client;
    client.connect();
  }, [containerId, getAuthToken]);

  const cleanup = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.close();
      clientRef.current = null;
    }
    completedRef.current = false;
    setIsStreaming(false);
  }, []);

  useEffect(() => {
    if (!containerId) return;

    mountedRef.current = true;
    void fetchHistoricalLogs();

    return (): void => {
      mountedRef.current = false;
      cleanup();
    };
  }, [containerId, fetchHistoricalLogs, cleanup]);

  // Start streaming if container is running
  useEffect(() => {
    if (container?.status === "running" && !completedRef.current && !isStreaming) {
      setupStreaming();
    }
  }, [container?.status, isStreaming, setupStreaming]);

  return { logs, isLoading, isStreaming, error };
}

/**
 * Hook to get container stats
 */
export function useContainerStats(
  containerId: string
): ReturnType<typeof useQuery<ContainerStats>> {
  return useQuery<ContainerStats>({
    queryKey: containerKeys.stats(containerId),
    queryFn: async () => {
      const response = await containersApi.getStats(containerId);
      return response.data;
    },
    enabled: !!containerId,
    refetchInterval: 5000,
  });
}

/**
 * Hook to start a container
 */
export function useStartContainer(): ReturnType<typeof useMutation<void, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (containerId: string) => {
      await containersApi.start(containerId);
    },
    onSuccess: (_, containerId) => {
      void queryClient.invalidateQueries({ queryKey: containerKeys.detail(containerId) });
      void queryClient.invalidateQueries({ queryKey: containerKeys.all });
    },
  });
}

/**
 * Hook to stop a container
 */
export function useStopContainer(): ReturnType<
  typeof useMutation<void, unknown, { containerId: string; timeout?: number }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ containerId, timeout }: { containerId: string; timeout?: number }) => {
      await containersApi.stop(containerId, timeout);
    },
    onSuccess: (_, { containerId }) => {
      void queryClient.invalidateQueries({ queryKey: containerKeys.detail(containerId) });
      void queryClient.invalidateQueries({ queryKey: containerKeys.all });
    },
  });
}

/**
 * Hook to restart a container
 */
export function useRestartContainer(): ReturnType<typeof useMutation<void, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (containerId: string) => {
      await containersApi.restart(containerId);
    },
    onSuccess: (_, containerId) => {
      void queryClient.invalidateQueries({ queryKey: containerKeys.detail(containerId) });
      void queryClient.invalidateQueries({ queryKey: containerKeys.all });
    },
  });
}

/**
 * Hook to remove a container
 */
export function useRemoveContainer(): ReturnType<
  typeof useMutation<void, unknown, { containerId: string; force?: boolean }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ containerId, force }: { containerId: string; force?: boolean }) => {
      await containersApi.remove(containerId, force);
    },
    onSuccess: (_, { containerId }) => {
      void queryClient.invalidateQueries({ queryKey: containerKeys.detail(containerId) });
      void queryClient.invalidateQueries({ queryKey: containerKeys.all });
    },
  });
}

/**
 * Hook to execute a command in a container
 */
export function useContainerExec(): ReturnType<
  typeof useMutation<
    { exitCode: number; output: string; error?: string },
    unknown,
    { containerId: string; command: string[] }
  >
> {
  return useMutation({
    mutationFn: async ({ containerId, command }: { containerId: string; command: string[] }) => {
      const response = await containersApi.exec(containerId, { command });
      return response.data;
    },
  });
}
