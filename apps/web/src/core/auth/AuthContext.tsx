import { createContext, useContext, type ReactNode } from "react";
import { useAuthSession, useLogin, useLogout } from "@/core/api/hooks/useAuth";
import type { AuthMeResponse } from "@forge/types";
import type { ApiClientError } from "@/core/api/client";

interface AuthContextValue {
  user: AuthMeResponse | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: ApiClientError | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps): React.ReactElement {
  const { data: user, isLoading, error } = useAuthSession();

  const loginMutation = useLogin();
  const logoutMutation = useLogout();

  const login = async (credentials: { email: string; password: string }): Promise<void> => {
    await loginMutation.mutateAsync(credentials);
  };

  const logout = async (): Promise<void> => {
    await logoutMutation.mutateAsync();
  };

  const value: AuthContextValue = {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    error: error ?? null,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
