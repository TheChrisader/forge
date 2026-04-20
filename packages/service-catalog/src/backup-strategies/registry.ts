import type { BackupStrategy } from "./types.js";
import { PostgreSQLBackupStrategy } from "./postgresql.js";
import { MySQLBackupStrategy } from "./mysql.js";
import { MongoDBBackupStrategy } from "./mongodb.js";
import { RedisBackupStrategy } from "./redis.js";
import { ElasticsearchBackupStrategy } from "./elasticsearch.js";
import { MeilisearchBackupStrategy } from "./meilisearch.js";
import { RabbitMQBackupStrategy } from "./rabbitmq.js";
import { MinIOBackupStrategy } from "./minio.js";
import { GrafanaBackupStrategy } from "./grafana.js";
import { PrometheusBackupStrategy } from "./prometheus.js";
import { NoOpBackupStrategy } from "./noop.js";

export class BackupStrategyRegistry {
  private readonly strategies: Map<string, BackupStrategy>;

  constructor() {
    this.strategies = new Map<string, BackupStrategy>([
      ["postgresql", new PostgreSQLBackupStrategy()],
      ["mysql", new MySQLBackupStrategy()],
      ["mongodb", new MongoDBBackupStrategy()],
      ["redis", new RedisBackupStrategy()],
      ["memcached", new NoOpBackupStrategy("memcached")],
      ["rabbitmq", new RabbitMQBackupStrategy()],
      ["nats", new NoOpBackupStrategy("nats")],
      ["minio", new MinIOBackupStrategy()],
      ["elasticsearch", new ElasticsearchBackupStrategy()],
      ["meilisearch", new MeilisearchBackupStrategy()],
      ["prometheus", new PrometheusBackupStrategy()],
      ["grafana", new GrafanaBackupStrategy()],
    ]);
  }

  get(engine: string): BackupStrategy {
    const strategy = this.strategies.get(engine);
    if (!strategy) {
      throw new Error(`No backup strategy for engine "${engine}"`);
    }
    return strategy;
  }

  has(engine: string): boolean {
    return this.strategies.has(engine);
  }
}

export const backupStrategyRegistry = new BackupStrategyRegistry();
