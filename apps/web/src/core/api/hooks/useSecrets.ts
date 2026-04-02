import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { secretsApi, type CreateSecretRequest, type UpdateSecretRequest } from "../clients/secrets";
import type { SecretResponse } from "../clients/secrets";

export const secretKeys = {
  all: ["secrets"] as const,
  lists: () => [...secretKeys.all, "list"] as const,
  list: (projectId: string) => [...secretKeys.lists(), projectId] as const,
};

export function useSecrets(projectId: string): ReturnType<typeof useQuery<SecretResponse[]>> {
  return useQuery<SecretResponse[]>({
    queryKey: secretKeys.list(projectId),
    queryFn: async () => {
      const response = await secretsApi.list(projectId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useCreateSecret(): ReturnType<
  typeof useMutation<SecretResponse, unknown, { projectId: string; data: CreateSecretRequest }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: CreateSecretRequest }) => {
      const response = await secretsApi.create(projectId, data);
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(projectId) });
    },
  });
}

export function useUpdateSecret(): ReturnType<
  typeof useMutation<
    SecretResponse,
    unknown,
    { projectId: string; id: string; data: UpdateSecretRequest }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      id,
      data,
    }: {
      projectId: string;
      id: string;
      data: UpdateSecretRequest;
    }) => {
      const response = await secretsApi.update(projectId, id, data);
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(projectId) });
    },
  });
}

export function useDeleteSecret(): ReturnType<
  typeof useMutation<void, unknown, { projectId: string; id: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, id }: { projectId: string; id: string }) => {
      await secretsApi.delete(projectId, id);
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.list(projectId) });
    },
  });
}
