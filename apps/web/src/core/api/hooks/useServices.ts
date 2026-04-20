import {
  useQuery,
  useMutation,
  useQueryClient,
  UseQueryResult,
  UseMutationResult,
} from "@tanstack/react-query";
import { EngineDetail, servicesApi } from "../clients/services";
import type { CreateServiceRequest, PaginatedResponse, Service, ServiceBackup } from "@forge/types";

export const serviceKeys = {
  all: ["services"] as const,
  lists: () => [...serviceKeys.all, "list"] as const,
  list: (filters?: object) => [...serviceKeys.lists(), filters] as const,
  details: () => [...serviceKeys.all, "detail"] as const,
  detail: (id: string) => [...serviceKeys.details(), id] as const,
  engines: () => [...serviceKeys.all, "engines"] as const,
  engine: (engine: string) => [...serviceKeys.all, "engines", engine] as const,
};

export function useServices(params?: {
  projectId?: string;
  page?: number;
  limit?: number;
  type?: string;
  status?: string | string[];
  search?: string;
}): UseQueryResult<PaginatedResponse<Service>, Error> {
  return useQuery({
    queryKey: serviceKeys.list(params),
    queryFn: () => servicesApi.getAll(params),
  });
}

export function useService(id: string): UseQueryResult<
  {
    data: Service;
  },
  Error
> {
  return useQuery({
    queryKey: serviceKeys.detail(id),
    queryFn: () => servicesApi.getById(id),
    enabled: !!id,
  });
}

export function useCreateService(): UseMutationResult<
  {
    data: Service;
  },
  Error,
  CreateServiceRequest,
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateServiceRequest) => servicesApi.create(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useDeleteService(): UseMutationResult<void, Error, string, unknown> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => servicesApi.delete(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useServiceEngines(): UseQueryResult<
  {
    data: EngineDetail[];
  },
  Error
> {
  return useQuery({
    queryKey: serviceKeys.engines(),
    queryFn: () => servicesApi.getEngines(),
    staleTime: 5 * 60 * 1000,
  });
}

export function useEngineConfig(engine: string): UseQueryResult<
  {
    data: EngineDetail;
  },
  Error
> {
  return useQuery({
    queryKey: serviceKeys.engine(engine),
    queryFn: () => servicesApi.getEngineConfig(engine),
    enabled: !!engine,
  });
}

export function useStartService(): UseMutationResult<
  {
    data: Service;
  },
  Error,
  string,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.start(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useStopService(): UseMutationResult<
  {
    data: Service;
  },
  Error,
  string,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.stop(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useRestartService(): UseMutationResult<
  {
    data: Service;
  },
  Error,
  string,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.restart(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useServiceBackups(serviceId: string): UseQueryResult<
  {
    data: ServiceBackup[];
  },
  Error
> {
  return useQuery({
    queryKey: ["services", serviceId, "backups"],
    queryFn: () => servicesApi.getBackups(serviceId),
    enabled: !!serviceId,
  });
}

export function useTriggerBackup(): UseMutationResult<
  {
    data: ServiceBackup;
  },
  Error,
  string,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.triggerBackup(id),
    onSuccess: (_, id) => {
      void queryClient.invalidateQueries({ queryKey: ["services", id, "backups"] });
    },
  });
}

export function useServiceLogs(
  id: string,
  tail?: number
): UseQueryResult<
  {
    data: {
      lines: string[];
    };
  },
  Error
> {
  return useQuery({
    queryKey: ["services", id, "logs"],
    queryFn: () => servicesApi.getLogs(id, tail),
    enabled: !!id,
    refetchInterval: 5000,
  });
}

export function useServiceStats(id: string): UseQueryResult<
  {
    data: Record<string, unknown>;
  },
  Error
> {
  return useQuery({
    queryKey: ["services", id, "stats"],
    queryFn: () => servicesApi.getStats(id),
    enabled: !!id,
    refetchInterval: 10000,
  });
}

export function useRestoreBackup(): UseMutationResult<
  {
    data: ServiceBackup;
  },
  Error,
  { serviceId: string; backupId: string },
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, backupId }: { serviceId: string; backupId: string }) =>
      servicesApi.restoreBackup(serviceId, backupId),
    onSuccess: (_, { serviceId }) => {
      void queryClient.invalidateQueries({ queryKey: ["services", serviceId, "backups"] });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
    },
  });
}

export function useUpdateBackupSchedule(): UseMutationResult<
  {
    data: Service;
  },
  Error,
  { serviceId: string; data: { schedule?: "daily" | "weekly"; retention?: number } },
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      serviceId,
      data,
    }: {
      serviceId: string;
      data: { schedule?: "daily" | "weekly"; retention?: number };
    }) => servicesApi.updateBackupSchedule(serviceId, data),
    onSuccess: (_, { serviceId }) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(serviceId) });
    },
  });
}

export function useLinkService(): UseMutationResult<
  {
    data: {
      success: boolean;
    };
  },
  Error,
  {
    serviceId: string;
    projectId: string;
  },
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, projectId }: { serviceId: string; projectId: string }) =>
      servicesApi.linkProject(serviceId, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useUnlinkService(): UseMutationResult<
  {
    data: {
      success: boolean;
    };
  },
  Error,
  {
    serviceId: string;
    projectId: string;
  },
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, projectId }: { serviceId: string; projectId: string }) =>
      servicesApi.unlinkProject(serviceId, projectId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}

export function useUpgradeService(): UseMutationResult<
  { data: { jobId: string } },
  Error,
  { serviceId: string; targetVersion: string },
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ serviceId, targetVersion }: { serviceId: string; targetVersion: string }) =>
      servicesApi.upgrade(serviceId, targetVersion),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: serviceKeys.detail(variables.serviceId) });
      void queryClient.invalidateQueries({ queryKey: serviceKeys.lists() });
    },
  });
}
