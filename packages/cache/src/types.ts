export const CACHE_KEYS = {
  PROJECT: "project:",
  DEPLOYMENT: "deployment:",
  BUILD_CACHE: "build:cache:",
  USER_SESSION: "session:",
  RATE_LIMIT: "ratelimit:",
} as const;

export interface CacheOptions {
  ttl?: number;
}
