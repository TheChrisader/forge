import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";
import type { Image } from "@forge/types";
import { imagesApi, type ImageStats, type PruneResult } from "../clients/images";

export const imageKeys = {
  all: ["images"] as const,
  lists: () => [...imageKeys.all, "list"] as const,
  list: (filters?: object) => [...imageKeys.lists(), filters] as const,
  stats: () => [...imageKeys.all, "stats"] as const,
};

export function useImages(params?: { project?: string; dangling?: boolean }): UseQueryResult<
  {
    data: Image[];
  },
  Error
> {
  return useQuery<{ data: Image[] }>({
    queryKey: imageKeys.list(params),
    queryFn: async () => {
      return await imagesApi.getAll(params);
    },
  });
}

export function useImageStats(params?: { project?: string }): UseQueryResult<ImageStats, Error> {
  return useQuery<ImageStats>({
    queryKey: [...imageKeys.stats(), params],
    queryFn: async () => {
      const response = await imagesApi.getStats(params);
      return response.data;
    },
  });
}

export function useDeleteImage(): UseMutationResult<
  void,
  Error,
  {
    id: string;
    force?: boolean;
  },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, force }: { id: string; force?: boolean }) => {
      await imagesApi.delete(id, { force });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: imageKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: imageKeys.stats() });
    },
  });
}

export function usePruneDangling(): UseMutationResult<PruneResult, Error, void, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<PruneResult> => {
      const response = await imagesApi.pruneDangling();
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: imageKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: imageKeys.stats() });
    },
  });
}

export function usePruneProject(): UseMutationResult<
  PruneResult,
  Error,
  {
    projectId: string;
    maxAgeDays?: number;
  },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      projectId,
      maxAgeDays,
    }: {
      projectId: string;
      maxAgeDays?: number;
    }): Promise<PruneResult> => {
      const response = await imagesApi.pruneProject(projectId, { maxAgeDays });
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: imageKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: imageKeys.stats() });
    },
  });
}
