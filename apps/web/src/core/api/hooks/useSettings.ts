import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../clients/auth";
import { authKeys } from "./useAuth";
import type {
  AuthMeResponse,
  ApiKeyResponse,
  UpdateProfileRequest,
  ChangePasswordRequest,
} from "@forge/types";
import type { ApiClientError } from "../client";

export const apiKeyKeys = {
  all: ["api-keys"] as const,
  list: () => [...apiKeyKeys.all, "list"] as const,
};

export function useApiKeys(): ReturnType<typeof useQuery<ApiKeyResponse[], ApiClientError>> {
  return useQuery<ApiKeyResponse[], ApiClientError>({
    queryKey: apiKeyKeys.list(),
    queryFn: () => authApi.listApiKeys(),
  });
}

export function useCreateApiKey(): ReturnType<
  typeof useMutation<
    ApiKeyResponse,
    ApiClientError,
    { name: string; scopes?: string[]; expiresAt?: string }
  >
> {
  const queryClient = useQueryClient();

  return useMutation<
    ApiKeyResponse,
    ApiClientError,
    { name: string; scopes?: string[]; expiresAt?: string }
  >({
    mutationFn: (data) => authApi.createApiKey(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() });
    },
  });
}

export function useRevokeApiKey(): ReturnType<
  typeof useMutation<{ success: boolean }, ApiClientError, string>
> {
  const queryClient = useQueryClient();

  return useMutation<{ success: boolean }, ApiClientError, string>({
    mutationFn: (id) => authApi.revokeApiKey(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: apiKeyKeys.list() });
    },
  });
}

export function useUpdateProfile(): ReturnType<
  typeof useMutation<AuthMeResponse, ApiClientError, UpdateProfileRequest>
> {
  const queryClient = useQueryClient();

  return useMutation<AuthMeResponse, ApiClientError, UpdateProfileRequest>({
    mutationFn: (data) => authApi.updateProfile(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

export function useChangePassword(): ReturnType<
  typeof useMutation<{ success: boolean }, ApiClientError, ChangePasswordRequest>
> {
  return useMutation<{ success: boolean }, ApiClientError, ChangePasswordRequest>({
    mutationFn: (data) => authApi.changePassword(data),
  });
}
