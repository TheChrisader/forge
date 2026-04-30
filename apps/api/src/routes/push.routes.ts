import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { z } from "zod";
import { requireAuth } from "../middleware/auth.js";
import { getDatabaseClient } from "@forge/database";

const SubscribeBodySchema = z.object({
  endpoint: z.url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

const UnsubscribeBodySchema = z.object({
  endpoint: z.url(),
});

export function registerPushRoutes(_server: FastifyInstance, _config: Config): void {
  const server = _server;

  server.get(
    "/api/push/vapid-key",
    {
      schema: { tags: ["push"] },
    },
    async (_request, reply) => {
      const publicKey = process.env.VAPID_PUBLIC_KEY;
      if (!publicKey) {
        return reply.status(503).send({ error: "Push notifications not configured" });
      }
      return reply.send({ data: { publicKey } });
    }
  );

  server.post(
    "/api/push/subscribe",
    {
      schema: {
        tags: ["push"],
        body: SubscribeBodySchema,
        response: {
          200: z.object({ data: z.object({ id: z.string() }) }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      const body = request.body as z.infer<typeof SubscribeBodySchema>;
      const db = getDatabaseClient();

      const subscription = await db.pushSubscription.upsert({
        where: {
          userId_endpoint: {
            userId,
            endpoint: body.endpoint,
          },
        },
        update: {
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
        create: {
          userId,
          endpoint: body.endpoint,
          p256dh: body.keys.p256dh,
          auth: body.keys.auth,
        },
      });

      return reply.send({ data: { id: subscription.id } });
    }
  );

  server.post(
    "/api/push/unsubscribe",
    {
      schema: {
        tags: ["push"],
        body: UnsubscribeBodySchema,
        response: {
          200: z.object({ data: z.object({ deleted: z.boolean() }) }),
        },
      },
    },
    async (request, reply) => {
      const userId = requireAuth((request as { userId?: string }).userId);
      const body = request.body as z.infer<typeof UnsubscribeBodySchema>;
      const db = getDatabaseClient();

      const result = await db.pushSubscription.deleteMany({
        where: {
          userId,
          endpoint: body.endpoint,
        },
      });

      return reply.send({ data: { deleted: result.count > 0 } });
    }
  );
}
