/**
 * Plugin system interfaces
 * Allows extending Forge with custom functionality
 */

export interface PluginMetadata {
  name: string;
  version: string;
  description?: string;
  author?: string;
  homepage?: string;
  keywords?: string[];
}

export interface PluginHooks {
  onLoad?(): Promise<void> | void;

  onUnload?(): Promise<void> | void;

  beforeDeploy?(context: { projectId: string; deploymentId: string }): Promise<void> | void;

  afterDeploy?(context: {
    projectId: string;
    deploymentId: string;
    success: boolean;
  }): Promise<void> | void;

  beforeBuild?(context: { projectId: string; deploymentId: string }): Promise<void> | void;

  afterBuild?(context: {
    projectId: string;
    deploymentId: string;
    success: boolean;
    image?: string;
  }): Promise<void> | void;

  onProjectCreate?(project: unknown): Promise<void> | void;

  onProjectDelete?(projectId: string): Promise<void> | void;
}

export interface IPlugin extends PluginHooks {
  readonly metadata: PluginMetadata;

  init(context: PluginContext): Promise<void> | void;

  destroy(): Promise<void> | void;
}

export interface PluginContext {
  registerEndpoint(path: string, handler: unknown): void;

  registerCommand(command: unknown): void;

  services: {
    projects: unknown;
    deployments: unknown;
    containers: unknown;
    logs: unknown;
    metrics: unknown;
  };

  emit(event: string, data: unknown): void;

  on(event: string, handler: (data: unknown) => void): void;
}

export interface IPluginManager {
  load(plugin: IPlugin): Promise<void>;

  unload(name: string): Promise<void>;

  getAll(): IPlugin[];

  get(name: string): IPlugin | null;

  executeHook<T extends keyof PluginHooks>(
    hook: T,
    ...args: Parameters<NonNullable<PluginHooks[T]>>
  ): Promise<void>;
}
