import axios, { type AxiosInstance, type AxiosError } from "axios";
import type {
  Project,
  Deployment,
  Service,
  LogEntry,
  CreateProjectRequest,
  UpdateProjectRequest,
  DeployProjectRequest,
  CreateServiceRequest,
  PaginatedResponse,
} from "@forge/types";

export class ApiClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, apiKey?: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
    });

    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError<unknown>) => {
        if (error.response) {
          const data = error.response.data as Record<string, unknown> | undefined;
          const errorMessage =
            ((data?.error as Record<string, unknown> | undefined)?.message as string | undefined) ||
            (data?.message as string | undefined) ||
            "API request failed";
          throw new Error(errorMessage);
        } else if (error.request) {
          throw new Error("No response from server. Is the Forge API running?");
        } else {
          throw new Error(error.message);
        }
      }
    );
  }

  async getProjects(params?: {
    page?: number;
    limit?: number;
  }): Promise<PaginatedResponse<Project>> {
    const response = await this.client.get<PaginatedResponse<Project>>("/api/projects", { params });
    return response.data;
  }

  async getProject(id: string): Promise<{ project: Project }> {
    const response = await this.client.get<{ project: Project }>(`/api/projects/${id}`);
    return response.data;
  }

  async createProject(data: CreateProjectRequest): Promise<{ project: Project }> {
    const response = await this.client.post<{ project: Project }>("/api/projects", data);
    return response.data;
  }

  async updateProject(id: string, data: UpdateProjectRequest): Promise<{ project: Project }> {
    const response = await this.client.put<{ project: Project }>(`/api/projects/${id}`, data);
    return response.data;
  }

  async deleteProject(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(`/api/projects/${id}`);
    return response.data;
  }

  async deployProject(
    id: string,
    data?: DeployProjectRequest
  ): Promise<{ deployment: Deployment }> {
    const response = await this.client.post<{ deployment: Deployment }>(
      `/api/projects/${id}/deploy`,
      data
    );
    return response.data;
  }

  async getDeployments(projectId: string): Promise<{ deployments: Deployment[] }> {
    const response = await this.client.get<{ deployments: Deployment[] }>(
      `/api/projects/${projectId}/deployments`
    );
    return response.data;
  }

  async rollbackDeployment(
    projectId: string,
    deploymentId?: string
  ): Promise<{ deployment: Deployment }> {
    const response = await this.client.post<{ deployment: Deployment }>(
      `/api/projects/${projectId}/rollback`,
      {
        deploymentId,
      }
    );
    return response.data;
  }

  async getServices(params?: { projectId?: string }): Promise<PaginatedResponse<Service>> {
    const response = await this.client.get<PaginatedResponse<Service>>("/api/services", { params });
    return response.data;
  }

  async createService(data: CreateServiceRequest): Promise<{ service: Service }> {
    const response = await this.client.post<{ service: Service }>("/api/services", data);
    return response.data;
  }

  async deleteService(id: string): Promise<{ success: boolean }> {
    const response = await this.client.delete<{ success: boolean }>(`/api/services/${id}`);
    return response.data;
  }

  async getLogs(params: {
    projectId?: string;
    since?: string;
    limit?: number;
  }): Promise<{ logs: LogEntry[] }> {
    const response = await this.client.get<{ logs: LogEntry[] }>("/api/logs", { params });
    return response.data;
  }
}
