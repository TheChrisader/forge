import { apiClient } from "../client";

export const pushApi = {
  getVapidKey: async (): Promise<{ data: { publicKey: string } }> => {
    return apiClient.get("/api/push/vapid-key");
  },

  subscribe: async (subscription: {
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }): Promise<{ data: { id: string } }> => {
    return apiClient.post("/api/push/subscribe", subscription);
  },

  unsubscribe: async (endpoint: string): Promise<{ data: { deleted: boolean } }> => {
    return apiClient.post("/api/push/unsubscribe", { endpoint });
  },
};
