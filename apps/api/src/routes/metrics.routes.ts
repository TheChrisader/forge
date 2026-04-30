import type { FastifyInstance } from "fastify";
import type { Config } from "@forge/core";
import { SERVICE_KEY_STRINGS } from "@forge/core";
import { MetricsQueryService, renderExposition } from "@forge/observability";
import { LoggerService } from "@forge/logger";
import { getTypedFastifyInstance } from "../utils/getTypedInstance.js";
import { requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { SSEManagerService } from "../services/sse-manager.service.js";
import { ConnectionLimitError } from "../errors/connection-limit.error.js";
import {
  MetricsQuerySchema,
  MetricsSourcesQuerySchema,
  MetricsStreamQuerySchema,
  SourceParamsSchema,
  LatestMetricsQuerySchema,
  SourceMetricsQuerySchema,
  TimeSeriesResultSchema,
  MetricSourceSchema,
  LatestMetricValueSchema,
  PlatformSummarySchema,
  PlatformSummaryQuerySchema,
  PrometheusQuerySchema,
} from "./metrics.schemas.js";
import z from "zod";

export function registerMetricsRoutes(_server: FastifyInstance, config: Config): void {
  const server = getTypedFastifyInstance(_server);
  const container = server.registry.getContainer();

  const metricsLogger = new LoggerService({
    level: config.nodeEnv === "production" ? "INFO" : "DEBUG",
    format: config.nodeEnv === "development" ? "pretty" : "json",
    enabled: true,
    name: "metrics-query",
  });

  const queryService = new MetricsQueryService(server.db, metricsLogger);

  // GET /metrics — Prometheus scrape endpoint (no auth)
  server.get(
    "/metrics",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
      schema: { tags: ["system"] },
    },
    async (_request, reply) => {
      const prometheusRegistry = server.prometheusRegistry;
      const dbProvider = server.prometheusDbProvider;

      let output = renderExposition(prometheusRegistry);

      try {
        const dbSamples = await dbProvider.getLatestMetricSamples();
        output += dbProvider.renderSamples(dbSamples);
      } catch (error) {
        server.logger.error("Failed to query DB for Prometheus metrics", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      reply
        .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        .status(200)
        .send(output);
    }
  );

  // GET /api/metrics/prometheus — Authenticated project-scoped Prometheus output
  server.get(
    "/api/metrics/prometheus",
    {
      config: {
        rateLimit: { max: 30, timeWindow: "1 minute" },
      },
      schema: {
        tags: ["system"],
        querystring: PrometheusQuerySchema,
      },
    },
    async (request, reply) => {
      requireAuth((request as { userId?: string }).userId);
      await requirePermission(request, { resource: "metrics", action: "read" });
      await requirePermission(request, {
        resource: "projects",
        action: "read",
        resourceId: request.query.projectId,
      });

      const dbProvider = server.prometheusDbProvider;
      const samples = await dbProvider.getLatestMetricSamplesForProject(request.query.projectId);

      const output = dbProvider.renderSamples(samples);

      return reply
        .header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
        .status(200)
        .send(output);
    }
  );

  // GET /api/metrics/stream — SSE endpoint for real-time metric updates
  server.get(
    "/api/metrics/stream",
    {
      sse: true,
      config: {
        rateLimit: { max: 10, timeWindow: "1 minute" },
      },
    },
    async (request, reply) => {
      const userId = (request as { userId?: string }).userId;
      requireAuth(userId);
      await requirePermission(request, { resource: "metrics", action: "read" });

      const query = MetricsStreamQuerySchema.parse(request.query);

      const topics = buildMetricsTopics(query);
      if (topics.length === 0) {
        return reply.status(400).send({ error: "At least one topic parameter is required" });
      }

      const sseManager = container.resolveSync<SSEManagerService>(SERVICE_KEY_STRINGS.SSE_MANAGER);

      await reply.sse.send({
        event: "metric.connected",
        data: { timestamp: new Date().toISOString(), topics },
      });

      try {
        for (const topic of topics) {
          sseManager.subscribe(topic, reply);
        }
      } catch (error) {
        if (error instanceof ConnectionLimitError) {
          await reply.sse.send({
            event: "metric.error",
            data: { code: "CONNECTION_LIMIT", message: error.message },
          });
          reply.sse.close();
          return;
        }
        throw error;
      }

      reply.sse.onClose(() => {
        for (const topic of topics) {
          sseManager.unsubscribe(topic, reply);
        }
      });

      reply.sse.keepAlive();
    }
  );

  // GET /api/metrics/summary — Platform-wide summary (must be before /:sourceType/:sourceId)
  server.get(
    "/api/metrics/summary",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["system"],
        querystring: PlatformSummaryQuerySchema,
        response: { 200: z.object({ data: PlatformSummarySchema }) },
      },
    },
    async (request, reply) => {
      await requirePermission(request, { resource: "metrics", action: "read" });
      const summary = await queryService.getPlatformSummary(request.query.lookback);
      return reply.status(200).send({ data: summary });
    }
  );

  // GET /api/metrics/query — General time-series query
  server.get(
    "/api/metrics/query",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["system"],
        querystring: MetricsQuerySchema,
        response: { 200: z.object({ data: z.array(TimeSeriesResultSchema) }) },
      },
    },
    async (request, reply) => {
      await requirePermission(request, { resource: "metrics", action: "read" });

      const query = request.query;
      if (query.projectId) {
        await requirePermission(request, {
          resource: "projects",
          action: "read",
          resourceId: query.projectId,
        });
      }

      const results = await queryService.getTimeSeries(query);
      return reply.status(200).send({ data: results });
    }
  );

  // GET /api/metrics/sources — List available metric sources
  server.get(
    "/api/metrics/sources",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["system"],
        querystring: MetricsSourcesQuerySchema,
        response: { 200: z.object({ data: z.array(MetricSourceSchema) }) },
      },
    },
    async (request, reply) => {
      await requirePermission(request, { resource: "metrics", action: "read" });
      const sources = await queryService.getSources(request.query);
      return reply.status(200).send({ data: sources });
    }
  );

  // GET /api/metrics/latest — Latest metric values
  server.get(
    "/api/metrics/latest",
    {
      config: { rateLimit: { max: 60, timeWindow: "1 minute" } },
      schema: {
        tags: ["system"],
        querystring: LatestMetricsQuerySchema,
        response: { 200: z.object({ data: z.array(LatestMetricValueSchema) }) },
      },
    },
    async (request, reply) => {
      await requirePermission(request, { resource: "metrics", action: "read" });
      const values = await queryService.getLatestValues(request.query);
      const serialized = values.map((v) => ({
        ...v,
        timestamp: v.timestamp instanceof Date ? v.timestamp.toISOString() : v.timestamp,
      }));
      return reply.status(200).send({ data: serialized });
    }
  );

  // GET /api/metrics/:sourceType/:sourceId — All metrics for a specific source
  server.get(
    "/api/metrics/:sourceType/:sourceId",
    {
      config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
      schema: {
        tags: ["system"],
        params: SourceParamsSchema,
        querystring: SourceMetricsQuerySchema,
        response: { 200: z.object({ data: z.array(TimeSeriesResultSchema) }) },
      },
    },
    async (request, reply) => {
      await requirePermission(request, { resource: "metrics", action: "read" });

      const { sourceType, sourceId } = request.params;
      const { from, to, interval } = request.query;
      const results = await queryService.getSourceMetrics(sourceType, sourceId, {
        from,
        to,
        interval,
      });
      return reply.status(200).send({ data: results });
    }
  );
}

function buildMetricsTopics(query: {
  sourceId?: string[];
  projectId?: string;
  platform?: boolean;
}): string[] {
  const topics: string[] = [];

  if (query.sourceId) {
    for (const id of query.sourceId) {
      topics.push(`metrics:source:${id}`);
    }
  }

  if (query.projectId) {
    topics.push(`metrics:project:${query.projectId}`);
  }

  if (query.platform) {
    topics.push("metrics:platform");
  }

  return topics;
}
