import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { projectsApi } from "../clients/projects";
import type {
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
} from "@forge/types";

export const projectKeys = {
  all: ["projects"] as const,
  lists: () => [...projectKeys.all, "list"] as const,
  list: (filters?: object) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, "detail"] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
  deployments: (id: string) => [...projectKeys.detail(id), "deployments"] as const,
};

export function useProjects(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: projectKeys.list(params),
    queryFn: () => projectsApi.getAll(params),
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: () => projectsApi.getById(id),
    enabled: !!id,
  });
}

export function useProjectDeployments(id: string) {
  return useQuery({
    queryKey: projectKeys.deployments(id),
    queryFn: () => projectsApi.getDeployments(id),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateProjectRequest) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProjectRequest }) =>
      projectsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
}

export function useDeployProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: DeployProjectRequest }) =>
      projectsApi.deploy(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.deployments(id) });
    },
  });
}

export function useRollbackDeployment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, deploymentId }: { id: string; deploymentId?: string }) =>
      projectsApi.rollback(id, deploymentId),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: projectKeys.deployments(id) });
    },
  });
}

export function useScaleProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, replicas }: { id: string; replicas: number }) =>
      projectsApi.scale(id, replicas),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
}
