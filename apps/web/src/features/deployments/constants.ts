import type { DeploymentStrategy } from "@forge/types";

/**
 * Exhaustive list of deployment strategies, typed to match the backend enum.
 * Used to build Zod schemas in the frontend without importing runtime values
 * from @forge/types (which is type-only for the web app).
 */
export const DEPLOYMENT_STRATEGY_VALUES = [
  "ROLLING",
  "BLUE_GREEN",
  "CANARY",
  "RECREATE",
] as const satisfies readonly DeploymentStrategy[];

/**
 * Strategies that are implemented in the backend but not yet exposed in the UI.
 * Displayed greyed-out until they are ready for use.
 */
export const DISABLED_STRATEGIES = ["CANARY"] as const satisfies readonly DeploymentStrategy[];

export interface StrategyOption {
  value: DeploymentStrategy;
  label: string;
  description: string;
}

export const DEPLOYMENT_STRATEGIES: StrategyOption[] = [
  {
    value: "ROLLING",
    label: "Rolling",
    description: "Zero-downtime gradual replacement of containers",
  },
  {
    value: "BLUE_GREEN",
    label: "Blue-Green",
    description: "Deploy to a new environment, switch traffic when healthy",
  },
  {
    value: "CANARY",
    label: "Canary",
    description: "Deploy a single container first, then progressively scale up",
  },
  {
    value: "RECREATE",
    label: "Recreate",
    description: "Stop all containers before starting new ones (brief downtime)",
  },
];
