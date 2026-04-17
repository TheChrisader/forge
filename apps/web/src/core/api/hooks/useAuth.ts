import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../clients/auth";
import { apiClient } from "../client";
import type { LoginRequest, AuthMeResponse } from "@forge/types";
import type { ApiClientError } from "../client";

export const authKeys = {
  all: ["auth"] as const,
  session: () => [...authKeys.all, "session"] as const,
};

export function useAuthSession(): ReturnType<
  typeof useQuery<AuthMeResponse | null, ApiClientError>
> {
  return useQuery<AuthMeResponse | null, ApiClientError>({
    queryKey: authKeys.session(),
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        const err = error as ApiClientError;
        if (err.statusCode === 401) {
          return null;
        }
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useLogin(): ReturnType<
  typeof useMutation<AuthMeResponse, ApiClientError, LoginRequest>
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (credentials: LoginRequest) => {
      const response = await authApi.login(credentials);
      apiClient.setAuthToken(response.accessToken);
      return await authApi.me();
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: authKeys.session() });
    },
  });
}

export function useLogout(): ReturnType<typeof useMutation<void, ApiClientError, void>> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      try {
        await authApi.logout();
      } catch {
        // Just pass through
      } finally {
        apiClient.removeAuthToken();
      }
    },
    onSuccess: () => {
      void queryClient.clear();
    },
  });
}
