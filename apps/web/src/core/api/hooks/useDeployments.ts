import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { deploymentsApi } from "../clients/deployments";
import type { Deployment } from "@forge/types";

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
  status?: string;
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

export function useDeployment(deploymentId: string): ReturnType<typeof useQuery<Deployment>> {
  return useQuery<Deployment>({
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
  typeof useMutation<Deployment, unknown, { projectId: string; version?: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, version }: { projectId: string; version?: string }) => {
      const response = await deploymentsApi.create(projectId, { version });
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

export function useDeploymentLogs(
  deploymentId: string
): ReturnType<typeof useQuery<{ logs: string }>> {
  return useQuery<{ logs: string }>({
    queryKey: deploymentKeys.logs(deploymentId),
    queryFn: async () => {
      const response = await deploymentsApi.getLogs(deploymentId);
      return response.data;
    },
    enabled: !!deploymentId,
    refetchInterval: 1000,
  });
}
