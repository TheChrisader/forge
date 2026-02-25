/**
 * Enum definitions for Forge platform
 * Single source of truth for application-level enums
 * (Database enums are in Prisma schema and imported from @forge/database)
 */

/**
 * Project source types - where the project code/image comes from
 * This is an application-level enum, stored as a string in the database
 */
export enum ProjectSourceType {
  GIT = "git",
  LOCAL = "local",
  IMAGE = "image",
  DOCKER_COMPOSE = "docker-compose",
}
