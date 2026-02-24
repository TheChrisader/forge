import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../clients/projects";
import type { CacheStats, CacheClearResult } from "@forge/types";

export const cacheKeys = {
  all: ["cache"] as const,
  details: (id: string) => [...cacheKeys.all, "detail", id] as const,
};

export function useCacheStats(projectId: string): ReturnType<typeof useQuery<CacheStats>> {
  return useQuery<CacheStats>({
    queryKey: cacheKeys.details(projectId),
    queryFn: async () => {
      const response = await projectsApi.getCacheStats(projectId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useClearCache(): ReturnType<
  typeof useMutation<CacheClearResult, unknown, { projectId: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId }: { projectId: string }) => {
      const response = await projectsApi.clearCache(projectId);
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: cacheKeys.details(projectId) });
    },
  });
}
