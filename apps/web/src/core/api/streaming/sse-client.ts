import type { ForgeErrorShape } from "@forge/types";
import { ApiClientError } from "../client";
import type {
  SSEConnectionOptions,
  SSEConnectionState,
  SSEEventHandler,
  SSEErrorHandler,
  SSEStateChangeHandler,
  ParsedSSEEvent,
} from "./types";
import { SSEParser } from "./sse-parser";

/**
 * Default connection options
 */
const DEFAULT_OPTIONS: Required<Omit<SSEConnectionOptions, "headers" | "autoConnect">> = {
  maxReconnectAttempts: 5,
  initialReconnectDelayMs: 1000,
  reconnectBackoffMultiplier: 2,
  maxReconnectDelayMs: 16000,
  connectionTimeoutMs: 30000,
  heartbeatTimeoutMs: 60000,
};

/**
 * Fetch-based SSE Client
 *
 * A robust SSE client implementation using the Fetch API that supports:
 * - Custom headers (for Authorization tokens)
 * - Exponential backoff with jitter on reconnection
 * - Last-Event-ID for event replay
 * - Connection and heartbeat timeouts
 * - Proper cleanup and resource management
 *
 * This replaces EventSource which doesn't support custom headers.
 */
export class SseClient {
  private url: string;
  private options: Required<Omit<SSEConnectionOptions, "headers" | "autoConnect">> & {
    headers: Record<string, string>;
  };

  // Connection management
  private abortController: AbortController | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // State tracking
  private currentState: SSEConnectionState = "disconnected";
  private reconnectAttempts = 0;
  private manualClose = false;
  private lastEventId?: string;

  // Parser
  private parser = new SSEParser();

  // Event handlers
  private onMessageHandlers = new Set<SSEEventHandler>();
  private onErrorHandlers = new Set<SSEErrorHandler>();
  private onStateChangeHandlers = new Set<SSEStateChangeHandler>();

  constructor(url: string, options: SSEConnectionOptions = {}) {
    this.url = url;
    this.options = { ...DEFAULT_OPTIONS, ...options, headers: options.headers || {} };

    if (options.autoConnect !== false) {
      this.connect();
    }
  }

  /**
   * Start the SSE connection
   */
  connect(): void {
    if (this.currentState === "connected" || this.currentState === "connecting") {
      return; // Already connected or connecting
    }

    this.manualClose = false;
    void this.performConnect();
  }

  /**
   * Close the SSE connection and prevent reconnection
   */
  close(): void {
    this.manualClose = true;
    this.abortController?.abort();

    // Cancel the reader to release resources immediately
    if (this.reader) {
      this.reader.cancel().catch(() => {});
      this.reader = null;
    }

    this.cleanup();
    this.setState("closed");
  }

  /**
   * Register a message handler
   * @returns Unsubscribe function
   */
  onMessage(handler: SSEEventHandler): () => void {
    this.onMessageHandlers.add(handler);
    return () => this.onMessageHandlers.delete(handler);
  }

  /**
   * Register an error handler
   * @returns Unsubscribe function
   */
  onError(handler: SSEErrorHandler): () => void {
    this.onErrorHandlers.add(handler);
    return () => this.onErrorHandlers.delete(handler);
  }

  /**
   * Register a state change handler
   * @returns Unsubscribe function
   */
  onStateChange(handler: SSEStateChangeHandler): () => void {
    this.onStateChangeHandlers.add(handler);
    return () => this.onStateChangeHandlers.delete(handler);
  }

  /**
   * Perform the actual connection attempt
   */
  private async performConnect(): Promise<void> {
    this.abortController = new AbortController();
    this.setState("connecting");
    this.parser.reset();

    // Setup connection timeout
    this.connectionTimeoutId = setTimeout(() => {
      this.abortController?.abort();
    }, this.options.connectionTimeoutMs);

    try {
      const headers: Record<string, string> = {
        Accept: "text/event-stream",
        "Cache-Control": "no-store",
        ...this.options.headers,
      };

      // CRITICAL: Send Last-Event-ID for replay on reconnection
      if (this.lastEventId) {
        headers["Last-Event-ID"] = this.lastEventId;
      }

      const response = await fetch(this.url, {
        headers,
        signal: this.abortController.signal,
      });

      // Clear connection timeout on successful response
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }

      // Check response status
      if (!response.ok) {
        await this.handleNonOkResponse(response);
        return;
      }

      // Verify Content-Type
      const contentType = response.headers.get("Content-Type");
      if (!contentType?.includes("text/event-stream")) {
        throw new ApiClientError(
          `Invalid content type: ${contentType}`,
          406,
          "INVALID_CONTENT_TYPE"
        );
      }

      // Start processing the stream
      await this.processStream(response);
    } catch (error) {
      // Clear connection timeout on error
      if (this.connectionTimeoutId) {
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
      }

      // CRITICAL: Don't update state if manually closed
      if (error instanceof Error && error.name === "AbortError" && this.manualClose) {
        return; // Silent exit, no error
      }

      this.handleConnectionError(this.normalizeError(error));
    }
  }

  /**
   * Process the SSE stream
   */
  private async processStream(response: Response): Promise<void> {
    const reader = response.body!.getReader();
    this.reader = reader;
    const decoder = new TextDecoder();

    this.setState("connected");
    this.reconnectAttempts = 0;
    this.resetHeartbeat();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        // CRITICAL: stream: true option handles multi-byte chars split across chunks
        const chunk = decoder.decode(value, { stream: true });

        // Reset heartbeat timeout on data received
        this.resetHeartbeat();

        const events = this.parser.parse(chunk);
        for (const event of events) {
          this.emitMessage(event);
        }
      }

      // Stream ended normally - flush any remaining data
      const finalEvent = this.parser.flush();
      if (finalEvent) {
        this.emitMessage(finalEvent);
      }
    } catch (error) {
      // Stream read error
      if (error instanceof Error && error.name === "AbortError" && this.manualClose) {
        return; // Silent exit
      }
      throw error;
    } finally {
      reader.releaseLock();
      this.reader = null;

      // Clear heartbeat timeout
      if (this.heartbeatTimeoutId) {
        clearTimeout(this.heartbeatTimeoutId);
        this.heartbeatTimeoutId = null;
      }
    }
  }

  /**
   * Handle non-OK HTTP responses
   */
  private async handleNonOkResponse(response: Response): Promise<void> {
    let errorData: ForgeErrorShape;

    try {
      const json = (await response.json()) as { error?: ForgeErrorShape };
      errorData = json.error ?? {
        message: response.statusText || "Unknown error",
        code: "UNKNOWN_ERROR",
        statusCode: response.status,
      };
    } catch {
      errorData = {
        message: response.statusText || "Unknown error",
        code: "UNKNOWN_ERROR",
        statusCode: response.status,
      };
    }

    const error = new ApiClientError(
      errorData.message,
      response.status,
      errorData.code,
      errorData.details
    );

    this.handleConnectionError(error);
  }

  /**
   * Handle connection errors with retry logic
   */
  private handleConnectionError(error: ApiClientError): void {
    // Only retry if not manually closed
    if (this.manualClose) return;

    const isRetryable =
      this.reconnectAttempts < this.options.maxReconnectAttempts &&
      (error.code === "NETWORK_ERROR" ||
        error.code === "TIMEOUT" ||
        (error.statusCode && [408, 429, 500, 502, 503, 504].includes(error.statusCode)));

    if (isRetryable) {
      this.emitError(error);
      this.scheduleReconnect();
    } else {
      this.setState("error");
      this.emitError(error);
    }
  }

  /**
   * Schedule a reconnection attempt with exponential backoff and jitter
   */
  private scheduleReconnect(): void {
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.options.maxReconnectAttempts) {
      this.setState("error");
      this.emitError(
        new ApiClientError("Max reconnection attempts exceeded", 0, "MAX_RETRIES_EXCEEDED")
      );
      return;
    }

    this.setState("disconnected");

    // Exponential backoff
    const baseDelay = Math.min(
      this.options.initialReconnectDelayMs *
        Math.pow(this.options.reconnectBackoffMultiplier, this.reconnectAttempts - 1),
      this.options.maxReconnectDelayMs
    );

    // CRITICAL: Add jitter: ±25% random variation to prevent thundering herd
    const jitter = baseDelay * 0.25 * (Math.random() * 2 - 1);
    const delay = baseDelay + jitter;

    this.reconnectTimeoutId = setTimeout(() => {
      void this.performConnect();
    }, delay);
  }

  /**
   * Normalize various error types to ApiClientError
   */
  private normalizeError(error: unknown): ApiClientError {
    if (error instanceof ApiClientError) return error;

    if (error instanceof Error && error.name === "AbortError") {
      return new ApiClientError("Request aborted", 0, "ABORTED");
    }

    if (error instanceof TypeError) {
      return new ApiClientError("Network error", 0, "NETWORK_ERROR");
    }

    return new ApiClientError("Unknown error", 0, "UNKNOWN_ERROR");
  }

  /**
   * Reset the heartbeat timeout
   * Call this whenever data is received from the server
   */
  private resetHeartbeat(): void {
    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
    }

    this.heartbeatTimeoutId = setTimeout(() => {
      // No data received for heartbeatTimeoutMs - connection is dead
      this.abortController?.abort();
    }, this.options.heartbeatTimeoutMs);
  }

  /**
   * Emit a message event to all registered handlers
   */
  private emitMessage(event: ParsedSSEEvent): void {
    // CRITICAL: Track last event ID for replay on reconnection
    if (event.id) {
      this.lastEventId = event.id;
    }

    for (const handler of this.onMessageHandlers) {
      try {
        handler(event);
      } catch (error) {
        console.error("Error in SSE message handler:", error);
      }
    }
  }

  /**
   * Emit an error event to all registered handlers
   */
  private emitError(error: ApiClientError): void {
    for (const handler of this.onErrorHandlers) {
      try {
        handler(error);
      } catch (err) {
        console.error("Error in SSE error handler:", err);
      }
    }
  }

  /**
   * Update state and notify state change handlers
   */
  private setState(state: SSEConnectionState): void {
    if (this.currentState !== state) {
      this.currentState = state;
      for (const handler of this.onStateChangeHandlers) {
        try {
          handler(state);
        } catch (error) {
          console.error("Error in SSE state change handler:", error);
        }
      }
    }
  }

  /**
   * Clean up all timers and resources
   */
  private cleanup(): void {
    if (this.connectionTimeoutId) {
      clearTimeout(this.connectionTimeoutId);
      this.connectionTimeoutId = null;
    }

    if (this.heartbeatTimeoutId) {
      clearTimeout(this.heartbeatTimeoutId);
      this.heartbeatTimeoutId = null;
    }

    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }
  }
}
