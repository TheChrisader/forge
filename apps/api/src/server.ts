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
import type { ILogger } from "@forge/core";
import { LoggerModule } from "@forge/logger";
import { InfrastructureModule } from "./modules/infrastructure.module.js";
import { setupSwagger } from "./plugins/swagger.js";
import { setupMiddleware } from "./middleware/index.js";
import { setupAuditLogging } from "./middleware/audit.js";
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
import { AuthModule } from "./modules/auth.module.js";
import { SecretModule } from "./modules/secret.module.js";
import { EnvironmentVariableModule } from "./modules/environment-variable.module.js";
import { TerminalModule } from "./modules/terminal.module.js";
import { ProxyModule } from "./modules/proxy.module.js";
import { ServiceManagerModule } from "./modules/service.module.js";
import { ServiceSSEModule } from "./modules/service-sse.module.js";
import { PermissionsService } from "@forge/auth";
import { attachPermissionsToRequest } from "./middleware/permissions.js";
import { TerminalService } from "./services/terminal.service.js";

declare module "fastify" {
  interface FastifyInstance {
    config: Config;
    logger: ILogger;
    registry: ServiceRegistry;
    db: PrismaClient;
    redis: Redis;
    permissionsService: PermissionsService;
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
  registry.registerModule("auth", new AuthModule());
  registry.registerModule("secrets", new SecretModule());
  registry.registerModule("environmentVariables", new EnvironmentVariableModule());
  registry.registerModule("terminal", new TerminalModule());
  registry.registerModule("proxy", new ProxyModule());
  registry.registerModule("services", new ServiceManagerModule());
  registry.registerModule("serviceSSE", new ServiceSSEModule());

  await registry.initialize();

  const container = registry.getContainer();
  const configService = await container.resolve<ConfigService>(SERVICE_KEY_STRINGS.CONFIG);
  const config = configService.getConfig();
  const logger = await container.resolve<ILogger>(SERVICE_KEY_STRINGS.LOGGER);
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

  setupAuditLogging(server);

  const permissionsService = new PermissionsService(db, redis);
  server.decorate("permissionsService", permissionsService);

  server.addHook("onRequest", (request, _, done) => {
    attachPermissionsToRequest(request, permissionsService);
    done();
  });

  setupRoutes(server);

  const defaultJsonParser = server.getDefaultJsonParser("error", "error");
  server.addContentTypeParser<string>(
    "application/json",
    { parseAs: "string" },
    (request, body, done) => {
      if (body === "" || body == null || (Buffer.isBuffer(body) && body.length === 0)) {
        return done(null, {});
      }
      return defaultJsonParser(request, body, done);
    }
  );

  await setupWebSocket(server);

  server.addHook("onClose", async () => {
    logger.info("Server shutting down, disposing services...");

    try {
      const terminalService = await container.resolve<TerminalService>(
        SERVICE_KEY_STRINGS.TERMINAL_SERVICE
      );
      await terminalService.dispose();
    } catch {
      // Terminal service may not be initialized
    }

    const infraModule = registry.getModule<InfrastructureModule>("infrastructure");
    if (infraModule) {
      await infraModule.dispose();
    }
  });

  return server;
}
