import type { FastifyInstance } from "fastify";
import websocketPlugin from "@fastify/websocket";
import { registerContainerWebSocketRoutes } from "../routes/containers.routes.js";

export async function setupWebSocket(server: FastifyInstance): Promise<void> {
  await server.register(websocketPlugin);
  registerContainerWebSocketRoutes(server);
}
