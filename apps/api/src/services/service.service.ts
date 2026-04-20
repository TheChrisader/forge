import type { PrismaClient, ServiceBackup } from "@forge/database";
import type { Service, ServiceStatus } from "@forge/database";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "@forge/core";
import { QueueService } from "@forge/queue";
import { encrypt, decrypt } from "@forge/security";
import { generateNetworkName } from "@forge/docker";
import type { IContainerRuntime } from "@forge/docker";
import {
  engineRegistry,
  EngineNotFoundError,
  InvalidVersionError,
  generateCredentials,
  sanitizeEnvPrefix,
} from "@forge/service-catalog";
import type { ServiceJobData } from "@forge/service-catalog";
import { SSEManagerService } from "./sse-manager.service.js";
import { ServiceProjectAccess } from "@forge/database/src/generated/client";
import { toPrismaJson } from "@forge/types";

const DEFAULT_SERVICE_LIMIT = 20;
const MASKED_PASSWORD = "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022";

const VALID_TRANSITIONS: Record<string, ServiceStatus[]> = {
  start: ["STOPPED", "ERROR"],
  stop: ["RUNNING", "HEALTHY", "UNHEALTHY"],
  restart: ["RUNNING", "HEALTHY", "UNHEALTHY"],
  delete: ["STOPPED", "ERROR"],
};

function transitionLabel(action: string, current: ServiceStatus): string {
  return `Cannot ${action} a service in ${current} state`;
}

export interface ListServicesFilters {
  projectId?: string;
  type?: string;
  status?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateServiceRequest {
  projectId: string;
  name: string;
  engine: string;
  version?: string;
  config?: Record<string, string>;
  credentials?: {
    username?: string;
    password?: string;
    database?: string;
  };
  resources?: {
    memoryMB?: number;
    cpuShares?: number;
  };
}

export interface ServiceConnection {
  host: string | null;
  port: number | null;
  url: string | null;
  username: string | null;
  password: string | null;
  database: string | null;
  envVars?: Record<string, string>;
}

export class ServiceService {
  constructor(
    private readonly db: PrismaClient,
    private readonly queueService: QueueService,
    private readonly encryptionKey: string,
    private readonly sseManager: SSEManagerService,
    private readonly runtime: IContainerRuntime
  ) {}

  async list(filters: ListServicesFilters): Promise<{ services: Service[]; total: number }> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { deletedAt: null };

    if (filters.projectId) {
      where.OR = [
        { projectId: filters.projectId },
        { projectAccess: { some: { projectId: filters.projectId } } },
      ];
    }

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.search) {
      where.name = {
        contains: filters.search,
        mode: "insensitive",
      };
    }

    const [services, total] = await Promise.all([
      this.db.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          _count: { select: { backups: true } },
        },
      }),
      this.db.service.count({ where }),
    ]);

    return { services, total };
  }

  async getById(id: string, userId: string): Promise<Service> {
    const service = await this.db.service.findUnique({
      where: { id, deletedAt: null },
      include: {
        backups: {
          take: 10,
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { backups: true } },
      },
    });

    if (!service) {
      throw new NotFoundError("Service");
    }

    await this.verifyAccess(service, userId);
    return service;
  }

  async create(data: CreateServiceRequest, userId: string): Promise<Service> {
    let engineDef;
    try {
      engineDef = engineRegistry.get(data.engine);
    } catch (err) {
      if (err instanceof EngineNotFoundError) {
        throw new BadRequestError(`Engine "${data.engine}" is not supported`);
      }
      throw err;
    }

    let resolvedVersion: string;
    try {
      resolvedVersion = data.version
        ? engineRegistry.validateVersion(data.engine, data.version).version
        : engineRegistry.getDefaultVersion(data.engine);
    } catch (err) {
      if (err instanceof InvalidVersionError) {
        const available = engineDef.supportedVersions.map((v) => v.version).join(", ");
        throw new BadRequestError(
          `Version "${data.version}" is not supported for ${data.engine}. Available: ${available}`
        );
      }
      throw err;
    }

    const project = await this.db.project.findUnique({
      where: { id: data.projectId },
    });
    if (!project) {
      throw new NotFoundError("Project");
    }

    const activeServiceCount = await this.db.service.count({
      where: {
        projectId: data.projectId,
        deletedAt: null,
        status: { notIn: ["STOPPED", "ERROR"] },
      },
    });
    if (activeServiceCount >= DEFAULT_SERVICE_LIMIT) {
      throw new ConflictError(`Project has reached the service limit (${DEFAULT_SERVICE_LIMIT})`);
    }

    const creds = data.credentials
      ? {
          username: data.credentials.username ?? "",
          password: data.credentials.password ?? "",
          database: data.credentials.database ?? "",
        }
      : generateCredentials(engineDef.type, data.engine, data.name);

    const internalHostname = `forge-svc-${crypto.randomUUID().slice(0, 8)}`;

    const connectionUrl = engineDef.connectionUrl({
      hostname: internalHostname,
      port: engineDef.defaultPort,
      username: creds.username,
      password: creds.password,
      database: creds.database,
    });

    const { ciphertext: encryptedPassword } = encrypt(creds.password, this.encryptionKey);

    const mergedConfig: Record<string, unknown> = { ...(data.config ?? {}) };
    if (data.resources) {
      mergedConfig.resources = data.resources;
    }

    const service = await this.db.service.create({
      data: {
        projectId: data.projectId,
        name: data.name,
        type: engineDef.type,
        engine: data.engine,
        status: "CREATING",
        version: resolvedVersion,
        config: toPrismaJson(mergedConfig) ?? {},
        connectionHost: internalHostname,
        connectionPort: engineDef.defaultPort,
        connectionUrl,
        connectionUsername: creds.username,
        connectionPassword: encryptedPassword,
        connectionDatabase: creds.database,
        internalHostname,
        volumeName: `forge-svc-data-${crypto.randomUUID().slice(0, 8)}`,
        createdBy: userId,
      },
    });

    await this.queueService.addJob("services", `provision-${service.id}`, {
      jobType: "PROVISION",
      serviceId: service.id,
      projectId: data.projectId,
    } satisfies ServiceJobData);

    this.sseManager.publish("services", {
      event: "service:creating",
      data: { serviceId: service.id },
    });

    return service;
  }

  async delete(id: string, userId: string): Promise<void> {
    const service = await this.db.service.findUnique({
      where: { id, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundError("Service");
    }

    await this.verifyAccess(service, userId);
    this.validateStateTransition(service.status, "delete");

    if (service.status === "CREATING" || service.status === "STARTING") {
      throw new ConflictError("Service is currently being provisioned. Wait for it to finish.");
    }

    try {
      await this.queueService.addJob("services", `deprovision-${id}`, {
        jobType: "DEPROVISION",
        serviceId: id,
        projectId: service.projectId,
      } satisfies ServiceJobData);
    } catch {
      // Best-effort cleanup job — the soft-delete proceeds regardless
    }

    await this.db.service.update({
      where: { id },
      data: { deletedAt: new Date(), status: "STOPPED" },
    });

    this.sseManager.publish("services", {
      event: "service:deleted",
      data: { serviceId: id },
    });
  }

  async start(id: string, userId: string): Promise<Service> {
    const service = await this.findAndVerify(id, userId);
    this.validateStateTransition(service.status, "start");

    const updated = await this.db.service.update({
      where: { id },
      data: { status: "STARTING" },
    });

    await this.queueService.addJob("services", `start-${id}`, {
      jobType: "START",
      serviceId: id,
      projectId: service.projectId,
    } satisfies ServiceJobData);

    this.sseManager.publish(`service:${id}`, {
      event: "service:starting",
      data: { serviceId: id },
    });

    return updated;
  }

  async stop(id: string, userId: string): Promise<Service> {
    const service = await this.findAndVerify(id, userId);
    this.validateStateTransition(service.status, "stop");

    const updated = await this.db.service.update({
      where: { id },
      data: { status: "STOPPING" },
    });

    await this.queueService.addJob("services", `stop-${id}`, {
      jobType: "STOP",
      serviceId: id,
      projectId: service.projectId,
    } satisfies ServiceJobData);

    this.sseManager.publish(`service:${id}`, {
      event: "service:stopping",
      data: { serviceId: id },
    });

    return updated;
  }

  async restart(id: string, userId: string): Promise<Service> {
    const service = await this.findAndVerify(id, userId);
    this.validateStateTransition(service.status, "restart");

    const updated = await this.db.service.update({
      where: { id },
      data: { status: "STARTING" },
    });

    await this.queueService.addJob("services", `restart-${id}`, {
      jobType: "RESTART",
      serviceId: id,
      projectId: service.projectId,
    } satisfies ServiceJobData);

    this.sseManager.publish(`service:${id}`, {
      event: "service:restarting",
      data: { serviceId: id },
    });

    return updated;
  }

  async getConnection(id: string, userId: string, reveal: boolean): Promise<ServiceConnection> {
    const service = await this.findAndVerify(id, userId);

    const connection: ServiceConnection = {
      host: service.connectionHost,
      port: service.connectionPort,
      url: service.connectionUrl,
      username: service.connectionUsername,
      password:
        reveal && service.connectionPassword
          ? decrypt(service.connectionPassword, this.encryptionKey)
          : service.connectionPassword
            ? MASKED_PASSWORD
            : null,
      database: service.connectionDatabase,
    };

    if (reveal && service.engine) {
      const engineDef = engineRegistry.get(service.engine);
      const envPrefix = sanitizeEnvPrefix(service.name);
      connection.envVars = engineDef.connectionEnvVars({
        envPrefix,
        hostname: service.connectionHost ?? "",
        port: service.connectionPort ?? engineDef.defaultPort,
        username: service.connectionUsername ?? "",
        password: connection.password ?? "",
        database: service.connectionDatabase ?? "",
      });
    }

    return connection;
  }

  async listBackups(serviceId: string, userId: string): Promise<ServiceBackup[]> {
    const service = await this.findAndVerify(serviceId, userId);
    return this.db.serviceBackup.findMany({
      where: { serviceId: service.id },
      orderBy: { createdAt: "desc" },
    });
  }

  async triggerBackup(serviceId: string, userId: string): Promise<ServiceBackup> {
    const service = await this.findAndVerify(serviceId, userId);

    if (service.status !== "RUNNING" && service.status !== "HEALTHY") {
      throw new ConflictError("Service must be running to trigger a backup");
    }

    const backup = await this.db.serviceBackup.create({
      data: {
        serviceId,
        type: "MANUAL",
        path: "",
        size: BigInt(0),
        status: "PENDING",
        createdBy: userId,
      },
    });

    await this.queueService.addJob("services", `backup-${backup.id}`, {
      jobType: "BACKUP",
      serviceId,
      projectId: service.projectId,
      backupId: backup.id,
    } satisfies ServiceJobData);

    return backup;
  }

  async restoreBackup(serviceId: string, backupId: string, userId: string): Promise<ServiceBackup> {
    const service = await this.findAndVerify(serviceId, userId);

    if (service.status !== "RUNNING" && service.status !== "HEALTHY") {
      throw new ConflictError("Service must be running to restore a backup");
    }

    const backup = await this.db.serviceBackup.findUnique({
      where: { id: backupId },
    });

    if (!backup || backup.serviceId !== serviceId) {
      throw new NotFoundError("Backup");
    }

    if (backup.status !== "COMPLETED") {
      throw new ConflictError("Backup must be completed before restoring");
    }

    await this.queueService.addJob("services", `restore-${backupId}`, {
      jobType: "RESTORE",
      serviceId,
      projectId: service.projectId,
      backupId,
      previousStatus: service.status,
    } satisfies ServiceJobData);

    return backup;
  }

  async updateBackupSchedule(
    serviceId: string,
    userId: string,
    schedule?: string,
    retention?: number
  ): Promise<Service> {
    await this.findAndVerify(serviceId, userId);

    return this.db.service.update({
      where: { id: serviceId },
      data: {
        autoBackupSchedule: schedule ?? null,
        autoBackupRetention: retention ?? null,
      },
    });
  }

  async getLogs(id: string, userId: string, options?: { tail?: number }): Promise<string[]> {
    const service = await this.findAndVerify(id, userId);

    if (!service.containerId) {
      throw new NotFoundError("Service container not found");
    }

    const entries: string[] = [];
    for await (const entry of this.runtime.logs(service.containerId, {
      tail: options?.tail ?? 100,
      follow: false,
      stdout: true,
      stderr: true,
    })) {
      entries.push(entry.message);
    }

    return entries;
  }

  async getStats(id: string, userId: string): Promise<Record<string, unknown>> {
    const service = await this.findAndVerify(id, userId);

    if (!service.containerId) {
      throw new NotFoundError("Service container not found");
    }

    const containerStats = await this.runtime.stats(service.containerId);

    return {
      serviceId: id,
      containerId: service.containerId,
      status: service.status,
      cpu: {
        usagePercent: containerStats.cpu.usage,
        systemUsage: containerStats.cpu.systemUsage,
        onlineCpus: containerStats.cpu.onlineCpus,
      },
      memory: {
        usageBytes: containerStats.memory.usage,
        limitBytes: containerStats.memory.limit,
        usagePercent: containerStats.memory.percentage,
      },
      network: {
        rxBytes: containerStats.network.rxBytes,
        txBytes: containerStats.network.txBytes,
      },
      blockIO: {
        readBytes: containerStats.blockIO.readBytes,
        writeBytes: containerStats.blockIO.writeBytes,
      },
      timestamp: containerStats.timestamp,
    };
  }

  async linkProject(serviceId: string, projectId: string, userId: string): Promise<void> {
    const service = await this.findAndVerify(serviceId, userId);

    if (!service.isShared) {
      throw new BadRequestError("Service is not shared and cannot be linked to other projects");
    }

    const targetProject = await this.db.project.findUnique({
      where: { id: projectId },
    });
    if (!targetProject) {
      throw new NotFoundError("Project");
    }

    const existing = await this.db.serviceProjectAccess.findUnique({
      where: { serviceId_projectId: { serviceId, projectId } },
    });
    if (existing) {
      throw new ConflictError("Service is already linked to this project");
    }

    await this.db.serviceProjectAccess.create({
      data: { serviceId, projectId, linkedBy: userId },
    });

    // If the service container already exists, attach it to the target project's network.
    // If the container doesn't exist yet (still provisioning), the provision handler
    // will pick up this link and attach after the container is created.
    await this.attachServiceToNetwork(service, projectId);

    this.sseManager.publish(`service:${serviceId}`, {
      event: "service:linked",
      data: { serviceId, projectId },
    });
  }

  async unlinkProject(serviceId: string, projectId: string, userId: string): Promise<void> {
    const service = await this.findAndVerify(serviceId, userId);

    const link = await this.db.serviceProjectAccess.findUnique({
      where: { serviceId_projectId: { serviceId, projectId } },
    });

    if (!link) {
      throw new NotFoundError("Service project link");
    }

    await this.db.serviceProjectAccess.delete({
      where: { id: link.id },
    });

    await this.detachServiceFromNetwork(service, projectId);

    this.sseManager.publish(`service:${serviceId}`, {
      event: "service:unlinked",
      data: { serviceId, projectId },
    });
  }

  async listLinkedProjects(serviceId: string, userId: string): Promise<ServiceProjectAccess[]> {
    const service = await this.findAndVerify(serviceId, userId);

    return this.db.serviceProjectAccess.findMany({
      where: { serviceId: service.id },
      include: { project: { select: { id: true, name: true } } },
      orderBy: { linkedAt: "desc" },
    });
  }

  private async attachServiceToNetwork(service: Service, targetProjectId: string): Promise<void> {
    if (!service.containerId || !service.internalHostname) return;

    const project = await this.db.project.findUnique({
      where: { id: targetProjectId },
      select: { name: true },
    });
    if (!project) return;

    const networkName = generateNetworkName(targetProjectId, project.name);

    try {
      await this.runtime.connectNetwork(service.containerId, networkName, {
        aliases: [service.internalHostname],
      });
    } catch (error) {
      if (error instanceof Error && !error.message.includes("already")) {
        throw error;
      }
    }
  }

  private async detachServiceFromNetwork(service: Service, targetProjectId: string): Promise<void> {
    if (!service.containerId) return;

    const project = await this.db.project.findUnique({
      where: { id: targetProjectId },
      select: { name: true },
    });
    if (!project) return;

    const networkName = generateNetworkName(targetProjectId, project.name);

    try {
      await this.runtime.disconnectNetwork(service.containerId, networkName);
    } catch {
      // Network gone or already disconnected — both fine
    }
  }

  async upgradeService(
    serviceId: string,
    targetVersion: string,
    userId: string
  ): Promise<{ jobId: string }> {
    const service = await this.findAndVerify(serviceId, userId);

    if (!service.engine) {
      throw new BadRequestError("Service has no engine specified");
    }

    const engineDef = engineRegistry.get(service.engine);

    const targetExists = engineDef.supportedVersions.some((v) => v.version === targetVersion);
    if (!targetExists) {
      const available = engineDef.supportedVersions.map((v) => v.version).join(", ");
      throw new BadRequestError(
        `Version "${targetVersion}" is not supported. Available: ${available}`
      );
    }

    const currentVersion = service.version ?? engineDef.defaultVersion;
    if (currentVersion === targetVersion) {
      throw new BadRequestError(`Service is already at version ${targetVersion}`);
    }

    const busyStates: ServiceStatus[] = [
      "CREATING",
      "STARTING",
      "STOPPING",
      "UPGRADING",
      "BACKING_UP",
      "RESTORING",
    ];
    if (busyStates.includes(service.status)) {
      throw new ConflictError(
        `Cannot upgrade service in ${service.status} state. Wait for the current operation to complete.`
      );
    }

    if (service.status !== "RUNNING" && service.status !== "HEALTHY") {
      throw new ConflictError(
        `Service must be RUNNING or HEALTHY to upgrade (current: ${service.status})`
      );
    }

    const jobData: ServiceJobData = {
      jobType: "UPGRADE",
      serviceId,
      projectId: service.projectId,
      previousStatus: service.status,
      targetVersion,
    };

    const jobId = await this.queueService.addJob("services", `upgrade-${service.id}`, jobData);
    return { jobId };
  }

  async findOrphans(userId: string): Promise<{
    orphanedContainers: { name: string; serviceId: string }[];
    orphanedVolumes: { name: string; serviceId: string }[];
  }> {
    // Verify admin access (TODO: simplified — any authenticated user can see orphans)
    if (!userId) {
      throw new ForbiddenError("Authentication required");
    }

    const containers = await this.runtime.list({
      label: { "forge.service": "true" },
    });

    const orphanedContainers: { name: string; serviceId: string }[] = [];
    for (const container of containers) {
      const serviceId = container.labels?.["forge.serviceId"];
      if (!serviceId) continue;

      const service = await this.db.service.findUnique({
        where: { id: serviceId },
        select: { deletedAt: true },
      });

      if (
        !service ||
        (service.deletedAt && Date.now() - service.deletedAt.getTime() > 24 * 60 * 60 * 1000)
      ) {
        orphanedContainers.push({
          name: container.name ?? container.id,
          serviceId,
        });
      }
    }

    const allVolumes = await this.runtime.listVolumes();
    const serviceVolumes = allVolumes.filter(
      (v) => v.labels?.["forge.serviceId"] || v.name?.startsWith("forge-svc-data-")
    );

    const orphanedVolumes: { name: string; serviceId: string }[] = [];
    for (const volume of serviceVolumes) {
      const serviceId =
        volume.labels?.["forge.serviceId"] ??
        volume.name?.match(/^forge-svc-data-([a-f0-9]{8})/)?.[1];
      if (!serviceId) continue;

      const service = await this.db.service.findUnique({
        where: { id: serviceId },
        select: { deletedAt: true },
      });

      if (
        !service ||
        (service.deletedAt && Date.now() - service.deletedAt.getTime() > 24 * 60 * 60 * 1000)
      ) {
        orphanedVolumes.push({ name: volume.name, serviceId });
      }
    }

    return { orphanedContainers, orphanedVolumes };
  }

  async cleanupOrphans(
    userId: string
  ): Promise<{ cleanedContainers: number; cleanedVolumes: number }> {
    if (!userId) {
      throw new ForbiddenError("Authentication required");
    }

    const { orphanedContainers, orphanedVolumes } = await this.findOrphans(userId);

    let cleanedContainers = 0;
    for (const orphan of orphanedContainers) {
      try {
        const info = await this.runtime.inspect(orphan.name);
        if (info.state?.running) {
          await this.runtime.stop(orphan.name, { timeout: 10 });
        }
        await this.runtime.remove(orphan.name, { force: true });
        cleanedContainers++;
      } catch {
        // Best-effort cleanup
      }
    }

    let cleanedVolumes = 0;
    for (const orphan of orphanedVolumes) {
      try {
        await this.runtime.removeVolume(orphan.name);
        cleanedVolumes++;
      } catch {
        // Best-effort cleanup
      }
    }

    return { cleanedContainers, cleanedVolumes };
  }

  private async findAndVerify(id: string, userId: string): Promise<Service> {
    const service = await this.db.service.findUnique({
      where: { id, deletedAt: null },
    });
    if (!service) {
      throw new NotFoundError("Service");
    }
    await this.verifyAccess(service, userId);
    return service;
  }

  private async verifyAccess(service: Service, userId: string): Promise<void> {
    if (!userId) {
      throw new ForbiddenError("Authentication required");
    }

    const isPlatformAdmin = await this.db.roleAssignment.findFirst({
      where: {
        userId,
        role: { isSystem: true, name: "platform_admin" },
      },
      select: { id: true },
    });

    if (isPlatformAdmin) return;

    const membership = await this.db.teamMember.findFirst({
      where: {
        userId,
        team: { projects: { some: { id: service.projectId } } },
      },
    });

    if (!membership) {
      throw new ForbiddenError("You do not have access to this service");
    }
  }

  private validateStateTransition(
    current: ServiceStatus,
    action: "start" | "stop" | "restart" | "delete"
  ): void {
    const allowed = VALID_TRANSITIONS[action];
    if (!allowed.includes(current)) {
      throw new ConflictError(transitionLabel(action, current));
    }
  }
}
