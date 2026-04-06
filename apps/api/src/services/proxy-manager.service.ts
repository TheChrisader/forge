import type { PrismaClient } from "@forge/database";
import type { ILogger } from "@forge/core";
import type { IReverseProxy, Route } from "@forge/proxy";
import type { IProxyIntegration } from "@forge/proxy";
import type { SslStatus } from "@forge/database";
import { generateNetworkName } from "@forge/docker";

export interface ProxyStatusResult {
  healthy: boolean;
  provider: string;
  routes: number;
  uptime: number;
  ssl: {
    enabled: boolean;
    activeCerts: number;
  };
}

export interface DomainInfo {
  id: string;
  projectId: string;
  domain: string;
  verified: boolean;
  isPrimary: boolean;
  sslStatus: SslStatus;
  verificationToken: string | null;
  sslIssuedAt: Date | null;
  sslExpiresAt: Date | null;
  createdAt: Date;
}

export interface AddDomainResult {
  domain: DomainInfo;
  dnsInstructions: DnsInstructions;
}

export interface DnsInstructions {
  type: "CNAME";
  name: string;
  value: string;
  ttl: number;
}

export class ProxyManagerService {
  private readonly providerName: string;

  constructor(
    private readonly proxy: IReverseProxy,
    private readonly integration: IProxyIntegration,
    private readonly db: PrismaClient,
    private readonly logger: ILogger,
    providerName: string = "unknown"
  ) {
    this.providerName = providerName;
  }

  async initialize(): Promise<void> {
    try {
      await this.integration.initialize();

      const runningDeployments = await this.db.deployment.findMany({
        where: { status: "RUNNING" },
        include: {
          project: {
            select: { id: true, name: true },
          },
        },
      });

      if (runningDeployments.length > 0) {
        this.logger.info("Reconciling proxy state with running deployments", {
          deploymentCount: runningDeployments.length,
        });

        for (const deployment of runningDeployments) {
          try {
            const projectSlug = deployment.project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");

            const container = await this.db.container.findFirst({
              where: { deploymentId: deployment.id },
              select: { containerId: true },
            });

            if (!container) {
              this.logger.warn(
                "No container record found for running deployment — skipping reconciliation",
                {
                  deploymentId: deployment.id,
                }
              );
              continue;
            }

            await this.integration.onContainerDeployed({
              projectId: deployment.project.id,
              projectSlug,
              deploymentId: deployment.id,
              containerId: container.containerId,
              networkName: generateNetworkName(deployment.project.id, deployment.project.name),
            });
          } catch (err) {
            this.logger.warn("Failed to reconcile deployment with proxy", {
              deploymentId: deployment.id,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }

      this.logger.info("Proxy system initialized successfully");
    } catch (error) {
      this.logger.error("Failed to initialize proxy system", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async addCustomDomain(projectId: string, domain: string): Promise<AddDomainResult> {
    if (!domain || domain.length > 255) {
      throw new Error("Invalid domain name");
    }

    const existing = await this.db.domain.findUnique({
      where: { domain },
    });

    if (existing) {
      throw new Error(`Domain "${domain}" is already registered`);
    }

    const project = await this.db.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    const verificationToken = `forge-verify-${crypto.randomUUID().replace(/-/g, "").substring(0, 16)}`;

    const domainRecord = await this.db.domain.create({
      data: {
        projectId,
        domain,
        verified: false,
        verificationToken,
        isPrimary: false,
        sslStatus: "PENDING",
      },
    });

    const projectSlug = project.name.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
    const autoSubdomain = this.integration.generateDeploymentUrl(projectSlug, true);

    return {
      domain: this.formatDomain(domainRecord),
      dnsInstructions: {
        type: "CNAME",
        name: domain,
        value: autoSubdomain.replace(/^https?:\/\//, ""),
        ttl: 300,
      },
    };
  }

  async verifyDomain(domainId: string): Promise<DomainInfo> {
    const domain = await this.db.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error(`Domain ${domainId} not found`);
    }

    // TODO: DNS verification
    // Query the DNS records and check for the CNAME/TXT record
    // matching the verification token.

    const updated = await this.db.domain.update({
      where: { id: domainId },
      data: { verified: true },
    });

    return this.formatDomain(updated);
  }

  async removeDomain(domainId: string): Promise<void> {
    const domain = await this.db.domain.findUnique({
      where: { id: domainId },
    });

    if (!domain) {
      throw new Error(`Domain ${domainId} not found`);
    }

    if (domain.verified) {
      try {
        const routeId = `forge-${domain.projectId.substring(0, 8)}`;
        await this.proxy.removeRoute(routeId);
      } catch (err) {
        this.logger.warn("Failed to remove proxy route for domain", {
          domainId,
          domain: domain.domain,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await this.db.domain.delete({
      where: { id: domainId },
    });
  }

  async getStatus(): Promise<ProxyStatusResult> {
    const status = await this.proxy.getStatus();

    const activeCerts = await this.db.domain.count({
      where: { sslStatus: "ACTIVE" },
    });

    return {
      healthy: status.healthy,
      provider: this.providerName,
      routes: status.routes,
      uptime: status.uptime,
      ssl: {
        enabled: status.healthy,
        activeCerts,
      },
    };
  }

  async getProjectDomains(projectId: string): Promise<DomainInfo[]> {
    const project = await this.db.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, domains: true },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    return project.domains.map((d) => this.formatDomain(d));
  }

  async getProjectRoutes(projectId: string): Promise<Route[]> {
    const routes = await this.proxy.getRoutes();
    const routeIdPrefix = `forge-${projectId.substring(0, 8)}`;
    return routes.filter((r) => r.id.startsWith(routeIdPrefix));
  }

  private formatDomain(d: {
    id: string;
    projectId: string;
    domain: string;
    verified: boolean;
    isPrimary: boolean;
    sslStatus: SslStatus;
    verificationToken: string | null;
    sslIssuedAt: Date | null;
    sslExpiresAt: Date | null;
    createdAt: Date;
  }): DomainInfo {
    return {
      id: d.id,
      projectId: d.projectId,
      domain: d.domain,
      verified: d.verified,
      isPrimary: d.isPrimary,
      sslStatus: d.sslStatus,
      verificationToken: d.verificationToken,
      sslIssuedAt: d.sslIssuedAt,
      sslExpiresAt: d.sslExpiresAt,
      createdAt: d.createdAt,
    };
  }
}
