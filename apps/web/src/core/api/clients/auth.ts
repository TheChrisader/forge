import { apiClient } from "../client";
import type {
  LoginRequest,
  LoginResponse,
  AuthMeResponse,
  ChangePasswordRequest,
  UpdateProfileRequest,
  ApiKeyResponse,
} from "@forge/types";

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response = await apiClient.post<LoginResponse>("/api/auth/login", credentials);
    if (response.refreshToken) {
      apiClient.setRefreshToken(response.refreshToken);
    }
    return response;
  },

  me: async (): Promise<AuthMeResponse> => {
    return apiClient.get<AuthMeResponse>("/api/auth/me");
  },

  logout: async (): Promise<void> => {
    return Promise.resolve();
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<AuthMeResponse> => {
    return apiClient.patch<AuthMeResponse>("/api/auth/me", data);
  },

  changePassword: async (data: ChangePasswordRequest): Promise<{ success: boolean }> => {
    return apiClient.post("/api/auth/change-password", data);
  },

  listApiKeys: async (): Promise<ApiKeyResponse[]> => {
    return apiClient.get<ApiKeyResponse[]>("/api/auth/api-keys");
  },

  createApiKey: async (data: {
    name: string;
    scopes?: string[];
    expiresAt?: string;
  }): Promise<ApiKeyResponse> => {
    return apiClient.post<ApiKeyResponse>("/api/auth/api-keys", data);
  },

  revokeApiKey: async (id: string): Promise<{ success: boolean }> => {
    return apiClient.delete<{ success: boolean }>(`/api/auth/api-keys/${id}`);
  },
};
