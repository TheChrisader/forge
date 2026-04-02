import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  environmentVariablesApi,
  type EnvironmentVariableResponse,
  type UpsertEnvVarsRequest,
} from "../clients/environment-variables";

export const envVarKeys = {
  all: ["environment-variables"] as const,
  lists: () => [...envVarKeys.all, "list"] as const,
  list: (projectId: string, environmentId?: string) =>
    [...envVarKeys.lists(), projectId, environmentId] as const,
  resolved: (projectId: string, environmentId?: string) =>
    [...envVarKeys.all, "resolved", projectId, environmentId] as const,
};

export function useEnvironmentVariables(
  projectId: string,
  environmentId?: string
): ReturnType<typeof useQuery<EnvironmentVariableResponse[]>> {
  return useQuery<EnvironmentVariableResponse[]>({
    queryKey: envVarKeys.list(projectId, environmentId),
    queryFn: async () => {
      const response = await environmentVariablesApi.list(projectId, environmentId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useResolvedEnvVars(
  projectId: string,
  environmentId?: string
): ReturnType<typeof useQuery<Record<string, string>>> {
  return useQuery<Record<string, string>>({
    queryKey: envVarKeys.resolved(projectId, environmentId),
    queryFn: async () => {
      const response = await environmentVariablesApi.getResolved(projectId, environmentId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useUpsertEnvVars(): ReturnType<
  typeof useMutation<
    EnvironmentVariableResponse[],
    unknown,
    { projectId: string; data: UpsertEnvVarsRequest }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: UpsertEnvVarsRequest }) => {
      const response = await environmentVariablesApi.upsert(projectId, data);
      return response.data;
    },
    onSuccess: (_, { projectId, data }) => {
      void queryClient.invalidateQueries({
        queryKey: envVarKeys.list(projectId, data.environmentId ?? undefined),
      });
      void queryClient.invalidateQueries({
        queryKey: envVarKeys.resolved(projectId),
      });
    },
  });
}

export function useDeleteEnvVar(): ReturnType<
  typeof useMutation<void, unknown, { projectId: string; key: string; environmentId?: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      key,
      environmentId,
    }: {
      projectId: string;
      key: string;
      environmentId?: string;
    }) => {
      await environmentVariablesApi.delete(projectId, key, environmentId);
    },
    onSuccess: (_, { projectId, environmentId }) => {
      void queryClient.invalidateQueries({
        queryKey: envVarKeys.list(projectId, environmentId),
      });
      void queryClient.invalidateQueries({
        queryKey: envVarKeys.resolved(projectId),
      });
    },
  });
}
