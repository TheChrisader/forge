import { FastifyBaseLogger, FastifyInstance, RawServerDefault } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import { IncomingMessage, ServerResponse } from "node:http";

export function getTypedFastifyInstance(
  fastify: FastifyInstance
): FastifyInstance<
  RawServerDefault,
  IncomingMessage,
  ServerResponse<IncomingMessage>,
  FastifyBaseLogger,
  ZodTypeProvider
> {
  return fastify.withTypeProvider<ZodTypeProvider>();
}
