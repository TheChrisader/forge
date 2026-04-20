import type { ServiceEngineDefinition } from "../types";

export { postgresqlEngine } from "./postgresql";
export { mysqlEngine } from "./mysql";
export { mongodbEngine } from "./mongodb";
export { redisEngine } from "./redis";
export { memcachedEngine } from "./memcached";
export { rabbitmqEngine } from "./rabbitmq";
export { natsEngine } from "./nats";
export { minioEngine } from "./minio";
export { elasticsearchEngine } from "./elasticsearch";
export { meilisearchEngine } from "./meilisearch";
export { prometheusEngine } from "./prometheus";
export { grafanaEngine } from "./grafana";

import { postgresqlEngine } from "./postgresql";
import { mysqlEngine } from "./mysql";
import { mongodbEngine } from "./mongodb";
import { redisEngine } from "./redis";
import { memcachedEngine } from "./memcached";
import { rabbitmqEngine } from "./rabbitmq";
import { natsEngine } from "./nats";
import { minioEngine } from "./minio";
import { elasticsearchEngine } from "./elasticsearch";
import { meilisearchEngine } from "./meilisearch";
import { prometheusEngine } from "./prometheus";
import { grafanaEngine } from "./grafana";

export const ALL_ENGINES: ServiceEngineDefinition[] = [
  postgresqlEngine,
  mysqlEngine,
  mongodbEngine,
  redisEngine,
  memcachedEngine,
  rabbitmqEngine,
  natsEngine,
  minioEngine,
  elasticsearchEngine,
  meilisearchEngine,
  prometheusEngine,
  grafanaEngine,
];
