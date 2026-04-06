import { apiClient } from "../client";

export interface DomainResponse {
  id: string;
  projectId: string;
  domain: string;
  verified: boolean;
  isPrimary: boolean;
  sslStatus: "PENDING" | "ACTIVE" | "EXPIRED" | "FAILED";
  verificationToken: string | null;
  sslIssuedAt: string | null;
  sslExpiresAt: string | null;
  createdAt: string;
}

export interface AddDomainRequest {
  domain: string;
  isPrimary?: boolean;
}

export interface DnsInstructions {
  type: "CNAME";
  name: string;
  value: string;
  ttl: number;
}

export interface AddDomainResponse {
  domain: DomainResponse;
  dnsInstructions: DnsInstructions;
}

export interface ProxyStatusResponse {
  healthy: boolean;
  provider: string;
  routes: number;
  uptime: number;
  ssl: {
    enabled: boolean;
    activeCerts: number;
  };
}

export const domainsApi = {
  list: async (projectId: string): Promise<{ data: DomainResponse[] }> => {
    return apiClient.get(`/api/projects/${projectId}/domains`);
  },

  add: async (projectId: string, data: AddDomainRequest): Promise<{ data: AddDomainResponse }> => {
    return apiClient.post(`/api/projects/${projectId}/domains`, data);
  },

  remove: async (projectId: string, domainId: string): Promise<void> => {
    return apiClient.delete(`/api/projects/${projectId}/domains/${domainId}`);
  },

  verify: async (projectId: string, domainId: string): Promise<{ data: DomainResponse }> => {
    return apiClient.post(`/api/projects/${projectId}/domains/${domainId}/verify`);
  },
};

export const proxyApi = {
  getStatus: async (): Promise<{ data: ProxyStatusResponse }> => {
    return apiClient.get("/api/proxy/status");
  },
};
