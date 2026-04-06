import { z } from "zod";
import { IdSchema } from "./common";

const DOMAIN_REGEX = /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export const AddDomainRequestSchema = z
  .object({
    domain: z.string().min(1).max(255).regex(DOMAIN_REGEX, "Must be a valid domain name"),
    isPrimary: z.boolean().optional().default(false),
  })
  .strict();

export type AddDomainRequest = z.infer<typeof AddDomainRequestSchema>;

export const DomainIdParamsSchema = z
  .object({
    projectId: IdSchema,
    domainId: IdSchema,
  })
  .strict();

const SslStatusSchema = z.enum(["PENDING", "ACTIVE", "EXPIRED", "FAILED"]);

export const DomainResponseSchema = z.object({
  id: z.uuid(),
  projectId: z.uuid(),
  domain: z.string(),
  verified: z.boolean(),
  isPrimary: z.boolean(),
  sslStatus: SslStatusSchema,
  verificationToken: z.string().nullable(),
  sslIssuedAt: z.date().nullable(),
  sslExpiresAt: z.date().nullable(),
  createdAt: z.date(),
});

export type DomainResponse = z.infer<typeof DomainResponseSchema>;

export const AddDomainResponseSchema = z.object({
  domain: DomainResponseSchema,
  dnsInstructions: z.object({
    type: z.literal("CNAME"),
    name: z.string(),
    value: z.string(),
    ttl: z.number(),
  }),
});

export type AddDomainResponse = z.infer<typeof AddDomainResponseSchema>;

export const ProxyStatusResponseSchema = z.object({
  healthy: z.boolean(),
  provider: z.string(),
  routes: z.number(),
  uptime: z.number(),
  ssl: z.object({
    enabled: z.boolean(),
    activeCerts: z.number(),
  }),
});

export type ProxyStatusResponse = z.infer<typeof ProxyStatusResponseSchema>;
