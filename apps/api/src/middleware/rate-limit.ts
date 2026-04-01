import type { FastifyRequest } from "fastify";

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export const RATE_LIMIT_TIERS = {
  free: { max: 100, windowMs: 60_000 },
  pro: { max: 1000, windowMs: 60_000 },
  enterprise: { max: 5000, windowMs: 60_000 },
} as const;

/**
 * Determines the rate limit for a given user.
 *
 * Currently returns the base config unchanged regardless of userId.
 * The function signature accepts a userId so that per-plan limits
 * can be introduced later by looking up the user's billing tier
 * and selecting from {@link RATE_LIMIT_TIERS} accordingly.
 *
 * @param _userId - The authenticated user's ID, or undefined for anonymous requests
 * @param baseConfig - The default rate limit configuration to use as a fallback
 * @returns A RateLimitConfig for this user
 */
export function getUserRateLimit(
  _userId: string | undefined,
  baseConfig: { max: number; windowMs: number }
): RateLimitConfig {
  // Placeholder: per-plan resolution will go here once billing tiers are implemented.
  // For now, every user gets the base config.
  return {
    max: baseConfig.max,
    windowMs: baseConfig.windowMs,
  };
}

/**
 * Generates a rate-limiting key for a request.
 *
 * Authenticated requests are scoped by userId so each user gets
 * their own bucket. Anonymous requests fall back to IP address.
 *
 * @param request - The incoming Fastify request
 * @returns A string key suitable for rate limit storage
 */
export function getUserRateLimitKey(request: FastifyRequest): string {
  return request.userId ?? request.ip;
}
