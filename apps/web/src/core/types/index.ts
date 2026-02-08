export * from "@forge/types";

export interface ToastNotification {
  id: string;
  type: "success" | "error" | "info" | "warning";
  message: string;
  duration?: number;
}
