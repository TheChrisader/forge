import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import fastifySSE from "@fastify/sse";
import { serializerCompiler, validatorCompiler, ZodTypeProvider } from "fastify-type-provider-zod";
import {
  ServiceRegistry,
  Config,
  ConfigModule,
  SERVICE_KEY_STRINGS,
  ConfigService,
} from "@forge/core";
import pino from "pino";
import { LoggerModule } from "./modules/logger.module.js";
import { InfrastructureModule } from "./modules/infrastructure.module.js";
import { setupSwagger } from "./plugins/swagger.js";
import { setupMiddleware } from "./middleware/index.js";
import { setupRoutes } from "./routes/index.js";
import { setupWebSocket } from "./websocket/index.js";
import { PrismaClient } from "@forge/database";
import Redis from "ioredis";
import { ProjectModule } from "./modules/project.module.js";
import { DeploymentModule } from "./modules/deployment.module.js";
import { BuildCacheModule } from "./modules/build-cache.module.js";
import { BuildLogModule } from "./modules/build-log.module.js";
import { SSEModule } from "./modules/sse.module.js";
import { ImageModule } from "./modules/image.module.js";
import { ContainerModule } from "./modules/container.module.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    logger: pino.Logger;
    registry: ServiceRegistry;
    db: PrismaClient;
    redis: Redis;
  }
}

export interface CreateServerOptions {
  logger?: boolean;
}

export async function createServer(_options: CreateServerOptions = {}): Promise<FastifyInstance> {
  const registry = new ServiceRegistry();

  registry.registerModule("config", new ConfigModule());
  registry.registerModule("logger", new LoggerModule());
  registry.registerModule("infrastructure", new InfrastructureModule());

  registry.registerModule("projects", new ProjectModule());
  registry.registerModule("deployments", new DeploymentModule());
  registry.registerModule("buildCache", new BuildCacheModule());
  registry.registerModule("sse", new SSEModule());
  registry.registerModule("buildLog", new BuildLogModule());
  registry.registerModule("image", new ImageModule());
  registry.registerModule("container", new ContainerModule());

  await registry.initialize();

  const container = registry.getContainer();
  const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
  const config = configService.getConfig();
  const logger = await container.resolve<pino.Logger>(SERVICE_KEY_STRINGS.LOGGER);
  const db = await container.resolve<PrismaClient>(SERVICE_KEY_STRINGS.DATABASE);
  const redis = await container.resolve<Redis>(SERVICE_KEY_STRINGS.CACHE);

  const fastifyOptions: FastifyServerOptions = {
    logger: false,
    disableRequestLogging: true,
    ajv: {
      customOptions: {
        coerceTypes: "array",
        removeAdditional: "all",
        useDefaults: true,
        strictNumbers: true,
        strictTuples: true,
      },
    },
    trustProxy: config.server.proxy,
    requestIdHeader: "x-request-id",
    requestIdLogLabel: "reqId",
    genReqId: () => crypto.randomUUID(),
  };

  const server = Fastify(fastifyOptions).withTypeProvider<ZodTypeProvider>();

  server.setValidatorCompiler(validatorCompiler);
  server.setSerializerCompiler(serializerCompiler);

  server.decorate("config", config);
  server.decorate("logger", logger);
  server.decorate("registry", registry);
  server.decorate("db", db);
  server.decorate("redis", redis);

  await server.register(fastifySSE, {
    heartbeatInterval: 30000, // 30 second keep-alive
  });

  await setupSwagger(server);

  await setupMiddleware(server, config);

  setupRoutes(server);

  await setupWebSocket(server);

  server.addHook("onClose", async () => {
    logger.info("Server shutting down, disposing services...");
    const infraModule = registry.getModule<InfrastructureModule>("infrastructure");
    if (infraModule) {
      await infraModule.dispose();
    }
  });

  return server;
}
