import type { IProxyIntegration } from "../../interfaces/integration";
import type { ProxyContainerRequirements, ProxyDeployResult } from "../../interfaces/integration";

export class NoOpProxyIntegration implements IProxyIntegration {
  // eslint-disable-next-line @typescript-eslint/require-await
  async prepareContainer(): Promise<ProxyContainerRequirements> {
    return { labels: {}, additionalNetworks: [] };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async onContainerDeployed(): Promise<ProxyDeployResult> {
    return { urls: [] };
  }

  async onContainerRemoved(): Promise<void> {
    // No-op
  }

  async initialize(): Promise<void> {
    // No-op
  }

  generateDeploymentUrl(): string {
    return "";
  }
}
