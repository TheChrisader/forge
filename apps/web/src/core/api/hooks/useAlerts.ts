import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  alertsApi,
  type AlertListParams,
  type AlertRuleListParams,
  type AlertChannelListParams,
} from "../clients/alerts";
import type {
  Alert,
  AlertRule,
  AlertChannel,
  CreateAlertRuleRequest,
  UpdateAlertRuleRequest,
  CreateAlertChannelRequest,
  UpdateAlertChannelRequest,
} from "@forge/types";

// Query key factories

export const alertKeys = {
  all: ["alerts"] as const,
  lists: () => [...alertKeys.all, "list"] as const,
  list: (params?: AlertListParams) => [...alertKeys.lists(), params] as const,
  details: () => [...alertKeys.all, "detail"] as const,
  detail: (id: string) => [...alertKeys.details(), id] as const,
};

export const alertRuleKeys = {
  all: ["alertRules"] as const,
  lists: () => [...alertRuleKeys.all, "list"] as const,
  list: (params?: AlertRuleListParams) => [...alertRuleKeys.lists(), params] as const,
  details: () => [...alertRuleKeys.all, "detail"] as const,
  detail: (id: string) => [...alertRuleKeys.details(), id] as const,
};

export const alertChannelKeys = {
  all: ["alertChannels"] as const,
  lists: () => [...alertChannelKeys.all, "list"] as const,
  list: (params?: AlertChannelListParams) => [...alertChannelKeys.lists(), params] as const,
  details: () => [...alertChannelKeys.all, "detail"] as const,
  detail: (id: string) => [...alertChannelKeys.details(), id] as const,
};

// Alert hooks

export function useAlerts(
  params?: AlertListParams
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof alertsApi.getAlerts>>>> {
  return useQuery({
    queryKey: alertKeys.list(params),
    queryFn: async () => {
      const response = await alertsApi.getAlerts(params);
      return response;
    },
    refetchInterval: params?.status?.includes("FIRING") ? 30_000 : false,
  });
}

export function useAlert(id: string): ReturnType<typeof useQuery<Alert>> {
  return useQuery({
    queryKey: alertKeys.detail(id),
    queryFn: async () => {
      const response = await alertsApi.getAlert(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useAcknowledgeAlert(): ReturnType<typeof useMutation<Alert, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await alertsApi.acknowledgeAlert(id);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

export function useResolveAlert(): ReturnType<typeof useMutation<Alert, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await alertsApi.resolveAlert(id);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertKeys.lists() });
    },
  });
}

// Alert Rule hooks

export function useAlertRules(
  params?: AlertRuleListParams
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof alertsApi.getRules>>>> {
  return useQuery({
    queryKey: alertRuleKeys.list(params),
    queryFn: async () => {
      const response = await alertsApi.getRules(params);
      return response;
    },
  });
}

export function useAlertRule(id: string): ReturnType<typeof useQuery<AlertRule>> {
  return useQuery({
    queryKey: alertRuleKeys.detail(id),
    queryFn: async () => {
      const response = await alertsApi.getRule(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateAlertRule(): ReturnType<
  typeof useMutation<AlertRule, unknown, CreateAlertRuleRequest>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAlertRuleRequest) => {
      const response = await alertsApi.createRule(data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}

export function useUpdateAlertRule(): ReturnType<
  typeof useMutation<AlertRule, unknown, { id: string; data: UpdateAlertRuleRequest }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAlertRuleRequest }) => {
      const response = await alertsApi.updateRule(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: alertRuleKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}

export function useDeleteAlertRule(): ReturnType<typeof useMutation<void, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await alertsApi.deleteRule(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}

// Alert Channel hooks

export function useAlertChannels(
  params?: AlertChannelListParams
): ReturnType<typeof useQuery<Awaited<ReturnType<typeof alertsApi.getChannels>>>> {
  return useQuery({
    queryKey: alertChannelKeys.list(params),
    queryFn: async () => {
      const response = await alertsApi.getChannels(params);
      return response;
    },
  });
}

export function useAlertChannel(id: string): ReturnType<typeof useQuery<AlertChannel>> {
  return useQuery({
    queryKey: alertChannelKeys.detail(id),
    queryFn: async () => {
      const response = await alertsApi.getChannel(id);
      return response.data;
    },
    enabled: !!id,
  });
}

export function useCreateAlertChannel(): ReturnType<
  typeof useMutation<AlertChannel, unknown, CreateAlertChannelRequest>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateAlertChannelRequest) => {
      const response = await alertsApi.createChannel(data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertChannelKeys.lists() });
    },
  });
}

export function useUpdateAlertChannel(): ReturnType<
  typeof useMutation<AlertChannel, unknown, { id: string; data: UpdateAlertChannelRequest }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateAlertChannelRequest }) => {
      const response = await alertsApi.updateChannel(id, data);
      return response.data;
    },
    onSuccess: (_, { id }) => {
      void queryClient.invalidateQueries({ queryKey: alertChannelKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: alertChannelKeys.lists() });
    },
  });
}

export function useDeleteAlertChannel(): ReturnType<typeof useMutation<void, unknown, string>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await alertsApi.deleteChannel(id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertChannelKeys.lists() });
    },
  });
}

export function useAddChannelRule(): ReturnType<
  typeof useMutation<
    { id: string },
    unknown,
    { channelId: string; data: { ruleId: string; severities: string[] } }
  >
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      channelId,
      data,
    }: {
      channelId: string;
      data: { ruleId: string; severities: string[] };
    }) => {
      const response = await alertsApi.addChannelRule(channelId, data);
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertChannelKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}

export function useRemoveChannelRule(): ReturnType<
  typeof useMutation<void, unknown, { channelId: string; ruleId: string }>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ channelId, ruleId }: { channelId: string; ruleId: string }) => {
      await alertsApi.removeChannelRule(channelId, ruleId);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: alertChannelKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: alertRuleKeys.lists() });
    },
  });
}
