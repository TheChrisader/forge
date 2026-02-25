import { apiClient } from "../client";
import type { Image } from "@forge/types";

export interface ImageStats {
  count: number;
  totalBytes: number;
}

export interface PruneResult {
  deleted: string[];
  reclaimedBytes: number;
  errors?: string[];
}

export const imagesApi = {
  /**
   * List all Docker images
   */
  getAll: async (params?: { project?: string; dangling?: boolean }): Promise<{ data: Image[] }> => {
    return apiClient.get("/api/images", { params });
  },

  /**
   * Get image disk usage statistics
   */
  getStats: async (params?: { project?: string }): Promise<{ data: ImageStats }> => {
    return apiClient.get("/api/images/stats", { params });
  },

  /**
   * Delete an image
   */
  delete: async (id: string, options?: { force?: boolean }): Promise<void> => {
    return apiClient.delete(`/api/images/${id}`, { params: options });
  },

  /**
   * Prune dangling images
   */
  pruneDangling: async (): Promise<{ data: PruneResult }> => {
    return apiClient.post("/api/images/prune");
  },

  /**
   * Prune old images for a specific project
   */
  pruneProject: async (
    projectId: string,
    options?: { maxAgeDays?: number }
  ): Promise<{ data: PruneResult }> => {
    return apiClient.post(`/api/projects/${projectId}/images/prune`, options);
  },
};
