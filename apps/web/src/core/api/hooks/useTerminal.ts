import { useState, useEffect, useCallback, useRef } from "react";

export type TerminalStatus = "connecting" | "connected" | "disconnected" | "closed";

export interface UseTerminalOptions {
  containerId: string;
  rows?: number;
  cols?: number;
  shell?: string;
  onData: (data: string) => void;
  onExit?: (exitCode: number) => void;
  onError?: (error: Error) => void;
  onStatusChange?: (status: TerminalStatus) => void;
}

export interface UseTerminalReturn {
  write: (data: string) => void;
  resize: (rows: number, cols: number) => void;
  close: () => void;
  status: TerminalStatus;
}

function getAuthToken(): string | null {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }
  try {
    return localStorage.getItem("auth_token");
  } catch {
    return null;
  }
}

function getWsBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:4000";
  return apiUrl.replace(/^http/, "ws");
}

export function useTerminal(options: UseTerminalOptions): UseTerminalReturn {
  const {
    containerId,
    rows: initialRows,
    cols: initialCols,
    shell,
    onData,
    onExit,
    onError,
    onStatusChange,
  } = options;

  const [status, setStatus] = useState<TerminalStatus>("connecting");
  const wsRef = useRef<WebSocket | null>(null);

  const setStatusSafe = useCallback(
    (newStatus: TerminalStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  useEffect(() => {
    let active = true;

    const token = getAuthToken();
    if (!token) {
      setStatusSafe("disconnected");
      onError?.(new Error("Not authenticated"));
      return;
    }

    const params = new URLSearchParams();
    params.set("token", token);
    if (initialRows) params.set("rows", String(initialRows));
    if (initialCols) params.set("cols", String(initialCols));
    if (shell) params.set("shell", shell);

    const wsUrl = `${getWsBaseUrl()}/api/containers/${containerId}/terminal?${params.toString()}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    setStatusSafe("connecting");

    ws.addEventListener("open", () => {
      if (!active) return;
      setStatusSafe("connected");
    });

    ws.addEventListener("message", (event: MessageEvent) => {
      if (!active) return;
      if (typeof event.data === "string") {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            exitCode?: number;
            error?: string;
          };
          if (msg.type === "exit" && typeof msg.exitCode === "number") {
            onExit?.(msg.exitCode);
          }
        } catch {
          onData(event.data);
        }
      } else if (event.data instanceof ArrayBuffer) {
        const decoder = new TextDecoder();
        onData(decoder.decode(event.data));
      }
    });

    ws.addEventListener("close", (event: CloseEvent) => {
      if (!active) return;
      if (event.code !== 1000) {
        setStatusSafe("disconnected");
        if (event.reason) {
          onError?.(new Error(event.reason));
        }
      } else {
        setStatusSafe("closed");
      }
    });

    ws.addEventListener("error", () => {
      if (!active) return;
      setStatusSafe("disconnected");
      onError?.(new Error("WebSocket connection error"));
    });

    return (): void => {
      active = false;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close(1000, "Client disconnect");
      }
      wsRef.current = null;
    };
  }, [containerId, shell, initialRows, initialCols, onData, onExit, onError, setStatusSafe]);

  const write = useCallback((data: string) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const encoder = new TextEncoder();
      ws.send(encoder.encode(data));
    }
  }, []);

  const resize = useCallback((newRows: number, newCols: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({ type: "resize", rows: newRows, cols: newCols });
      ws.send(msg);
    }
  }, []);

  const close = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      ws.close(1000, "User closed terminal");
    }
  }, []);

  return { write, resize, close, status };
}
