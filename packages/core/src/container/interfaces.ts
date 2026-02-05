export interface IDisposable {
  dispose(): Promise<void> | void;
}

export interface IInitializable {
  initialize(): Promise<void> | void;
}

export interface ILifecycle extends IDisposable, IInitializable {}

export interface ServiceMetadata {
  name: string;
  version?: string;
  dependencies?: string[];
}
