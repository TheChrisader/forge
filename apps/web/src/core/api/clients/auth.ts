import { apiClient } from "../client";
import type { LoginRequest, LoginResponse, AuthMeResponse } from "@forge/types";

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    return apiClient.post("/api/auth/login", credentials);
  },

  me: async (): Promise<AuthMeResponse> => {
    return apiClient.get("/api/auth/me");
  },

  logout: async (): Promise<void> => {
    return Promise.resolve();
  },
};
