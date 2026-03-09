import type { ApiClientError } from "../client";

/**
 * Parsed SSE event following W3C spec
 * @see https://html.spec.whatwg.org/multipage/server-sent-events.html
 */
export interface ParsedSSEEvent {
  /** Last-Event-ID for replay on reconnection */
  id?: string;
  /** Event type (defaults to "message" if not specified) */
  event?: string;
  /** Event data payload */
  data: string;
  /** Server's suggested retry delay in milliseconds */
  retry?: number;
}

/**
 * Configuration options for SSE connection
 */
export interface SSEConnectionOptions {
  /** Maximum number of reconnection attempts (default: 5) */
  maxReconnectAttempts?: number;
  /** Initial delay before first reconnect attempt in ms (default: 1000) */
  initialReconnectDelayMs?: number;
  /** Multiplier for exponential backoff (default: 2) */
  reconnectBackoffMultiplier?: number;
  /** Maximum delay between reconnect attempts in ms (default: 16000) */
  maxReconnectDelayMs?: number;
  /** Connection timeout - time to wait for first byte in ms (default: 30000) */
  connectionTimeoutMs?: number;
  /** Heartbeat timeout - max time without data before considering connection dead (default: 60000) */
  heartbeatTimeoutMs?: number;
  /** Whether to automatically connect on construction (default: true) */
  autoConnect?: boolean;
  /** Custom headers to include with the request */
  headers?: Record<string, string>;
}

/**
 * Possible states of an SSE connection
 */
export type SSEConnectionState =
  | "connecting" // Initial connection attempt in progress
  | "connected" // Successfully connected and receiving events
  | "disconnected" // Temporarily disconnected, will retry
  | "error" // Non-recoverable error occurred
  | "closed"; // Connection manually closed, will not reconnect

/**
 * Handler for incoming SSE events
 */
export type SSEEventHandler = (event: ParsedSSEEvent) => void;

/**
 * Handler for SSE connection errors
 */
export type SSEErrorHandler = (error: ApiClientError) => void;

/**
 * Handler for SSE connection state changes
 */
export type SSEStateChangeHandler = (state: SSEConnectionState) => void;
