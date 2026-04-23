import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../clients/projects";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
  Project,
} from "@forge/types";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters?: object) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  deployments: (id: string) => [...projectKeys.detail(id), "deployments"] as const,
};

export function useProjects(params?: {
  page?: number;
  limit?: number;
}): ReturnType<typeof useQuery<Project[]>> {
  return useQuery<Project[]>({
    queryKey: projectKeys.list(params),
    queryFn: async () => {
      const response = await projectsApi.getAll(params);
      return response.data;
    },
  });
}

export function useProject(id: string): ReturnType<typeof useQuery<Project>> {
  return useQuery<Project>({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const response = await projectsApi.getById(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export type ProjectWithGit = Project & {
  gitIntegration?: { id: string; repository: string; branch: string };
};

export function useProjectWithGitIntegration(
  projectId: string
): ReturnType<typeof useQuery<ProjectWithGit>> {
  return useQuery<ProjectWithGit>({
    queryKey: [...projectKeys.detail(projectId), "withGit"] as const,
    queryFn: async () => {
      const response = await projectsApi.getWithGitIntegration(projectId);
      return response.data as ProjectWithGit;
    },
    enabled: !!projectId,
  });
}

/**
 * DEPRECATED: Use useProjectDeployments from useDeployments instead
 * This endpoint may not exist
 */
// export function useProjectDeployments(id: string): ReturnType<typeof useQuery<unknown[]>> {
//   return useQuery<unknown[]>({
//     queryKey: projectKeys.deployments(id),
//     queryFn: async () => {
//       const response = await projectsApi.getDeployments(id);
//       return response.deployments;
//     },
//     enabled: !!id,
//   });
// }

export function useCreateProject(): ReturnType<
  typeof useMutation<Project, unknown, CreateProjectRequest>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateProjectRequest) => {
      const response = await projectsApi.create(data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject(): ReturnType<
  typeof useMutation<Project, unknown, { id: string; data: UpdateProjectRequest }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectRequest }) => {
      const response = await projectsApi.update(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function usePatchProject(): ReturnType<
  typeof useMutation<Project, unknown, { id: string; data: UpdateProjectRequest }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateProjectRequest }) => {
      const response = await projectsApi.patch(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject(): ReturnType<typeof useMutation<void, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await projectsApi.delete(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useStopProject(): ReturnType<typeof useMutation<void, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await projectsApi.stop(id);
    },
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

/**
 * DEPRECATED: This endpoint is a stub and not functional
 * Use useCreateDeployment from useDeployments instead
 */
export function useDeployProject(): ReturnType<
  typeof useMutation<unknown, unknown, { id: string; data?: DeployProjectRequest }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data?: DeployProjectRequest }) => {
      const response = await projectsApi.deploy(id, data);
      return response.deployment;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.deployments(id) });
    },
  });
}

/**
 * DEPRECATED: Rollback functionality - not yet implemented
 */
export function useRollbackDeployment(): ReturnType<
  typeof useMutation<unknown, unknown, { id: string; deploymentId?: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, deploymentId }: { id: string; deploymentId?: string }) => {
      const response = await projectsApi.rollback(id, deploymentId);
      return response.deployment;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: projectKeys.deployments(id) });
    },
  });
}

/**
 * DEPRECATED: Scale functionality - not yet implemented
 */
export function useScaleProject(): ReturnType<
  typeof useMutation<unknown, unknown, { id: string; replicas: number }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, replicas }: { id: string; replicas: number }) => {
      const response = await projectsApi.scale(id, replicas);
      return response.success;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}
