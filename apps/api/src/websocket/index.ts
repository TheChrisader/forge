import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";

export async function setupWebSocket(server: FastifyInstance): Promise<void> {
  await server.register(websocketPlugin);

  // TODO: Add WebSocket routes
  // - deployment logs streaming
  // - real-time status updates
  // etc.
}
