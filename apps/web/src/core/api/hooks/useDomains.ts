import {
  useQuery,
  useMutation,
  useQueryClient,
  UseMutationResult,
  UseQueryResult,
} from "@tanstack/react-query";
import {
  AddDomainResponse,
  domainsApi,
  proxyApi,
  type AddDomainRequest,
  type DomainResponse,
  type ProxyStatusResponse,
} from "../clients/domains";

export const domainKeys = {
  all: ["domains"] as const,
  lists: () => [...domainKeys.all, "list"] as const,
  list: (projectId: string) => [...domainKeys.lists(), projectId] as const,
};

export const proxyKeys = {
  all: ["proxy"] as const,
  status: () => [...proxyKeys.all, "status"] as const,
};

export function useDomains(projectId: string): ReturnType<typeof useQuery<DomainResponse[]>> {
  return useQuery<DomainResponse[]>({
    queryKey: domainKeys.list(projectId),
    queryFn: async () => {
      const response = await domainsApi.list(projectId);
      return response.data;
    },
    enabled: !!projectId,
  });
}

export function useAddDomain(): UseMutationResult<
  AddDomainResponse,
  Error,
  {
    projectId: string;
    data: AddDomainRequest;
  },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, data }: { projectId: string; data: AddDomainRequest }) => {
      const response = await domainsApi.add(projectId, data);
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
    },
  });
}

export function useRemoveDomain(): UseMutationResult<
  void,
  Error,
  {
    projectId: string;
    domainId: string;
  },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, domainId }: { projectId: string; domainId: string }) => {
      await domainsApi.remove(projectId, domainId);
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
    },
  });
}

export function useVerifyDomain(): UseMutationResult<
  DomainResponse,
  Error,
  {
    projectId: string;
    domainId: string;
  },
  unknown
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, domainId }: { projectId: string; domainId: string }) => {
      const response = await domainsApi.verify(projectId, domainId);
      return response.data;
    },
    onSuccess: (_, { projectId }) => {
      void queryClient.invalidateQueries({ queryKey: domainKeys.list(projectId) });
    },
  });
}

export function useProxyStatus(): UseQueryResult<ProxyStatusResponse, Error> {
  return useQuery<ProxyStatusResponse>({
    queryKey: proxyKeys.status(),
    queryFn: async () => {
      const response = await proxyApi.getStatus();
      return response.data;
    },
    refetchInterval: 60_000,
  });
}
