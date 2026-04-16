import type { IDeploymentStrategy, IDeploymentStrategyRegistry } from "../interfaces/strategy";

export class DeploymentStrategyRegistry implements IDeploymentStrategyRegistry {
  private strategies: Map<string, IDeploymentStrategy> = new Map();

  register(strategy: IDeploymentStrategy): void {
    if (this.strategies.has(strategy.strategyName)) {
      throw new Error(`Strategy "${strategy.strategyName}" is already registered`);
    }
    this.strategies.set(strategy.strategyName, strategy);
  }

  get(name: string): IDeploymentStrategy | null {
    return this.strategies.get(name) ?? null;
  }

  getAll(): IDeploymentStrategy[] {
    return Array.from(this.strategies.values());
  }
}
