export interface ProxyContainerContext {
  projectId: string;
  projectSlug: string;
  deploymentId: string;
  targetPort: number;
  domains: string[];
  networkName: string;
}

export interface ProxyContainerRequirements {
  labels: Record<string, string>;
  additionalNetworks: Array<{ name: string; aliases?: string[] }>;
}

export interface ProxyDeployedContext {
  projectId: string;
  projectSlug: string;
  deploymentId: string;
  containerId: string;
  networkName: string;
}

export interface ProxyDeployResult {
  urls: string[];
}

export interface ProxyRemovedContext {
  projectId: string;
  deploymentId: string;
  containerId: string;
  networkName: string;
}

export interface IProxyIntegration {
  prepareContainer(context: ProxyContainerContext): Promise<ProxyContainerRequirements>;

  onContainerDeployed(context: ProxyDeployedContext): Promise<ProxyDeployResult>;

  onContainerRemoved(context: ProxyRemovedContext): Promise<void>;

  initialize(): Promise<void>;

  generateDeploymentUrl(projectSlug: string, isPrimary: boolean): string;
}
