/**
 * Type declarations for authentication
 * Extends Fastify's Request interface with auth-related properties
 * Don't remove this
 */
import { FastifyRequest } from "fastify";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}
