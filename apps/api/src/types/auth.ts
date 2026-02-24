/**
 * Type declarations for authentication
 * Extends Fastify's Request interface with auth-related properties
 * Don't remove this
 */
// @ts-expect-error TS6133
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}
