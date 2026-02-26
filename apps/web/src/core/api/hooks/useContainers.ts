import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { containersApi } from "../clients/containers";
import type { DockerContainer, ContainerStats } from "@forge/types";

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
  projectId: string
): ReturnType<typeof useQuery<DockerContainer[]>> {
  return useQuery<DockerContainer[]>({
    queryKey: containerKeys.byProject(projectId),
    queryFn: async () => {
      const response = await containersApi.getByProject(projectId);
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
 * Hook to get container logs
 */
export function useContainerLogs(
  containerId: string,
  params?: { tail?: number | "all"; follow?: boolean }
): ReturnType<typeof useQuery<string[]>> {
  return useQuery<string[]>({
    queryKey: [...containerKeys.logs(containerId), params],
    queryFn: async () => {
      const response = await containersApi.getLogs(containerId, params);
      return response.data;
    },
    enabled: !!containerId,
    refetchInterval: params?.follow ? 1000 : 5000,
  });
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
