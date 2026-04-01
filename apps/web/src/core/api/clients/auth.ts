import { apiClient } from "../client";
import type {
  LoginRequest,
  LoginResponse,
  AuthMeResponse,
  ChangePasswordRequest,
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

  changePassword: async (data: ChangePasswordRequest): Promise<{ success: boolean }> => {
    return apiClient.post("/api/auth/change-password", data);
  },
};
