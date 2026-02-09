import { Command } from "commander";
import { ApiClient } from "../client/api.js";
import { ConfigManager } from "../config/manager.js";
import { output } from "../utils/output.js";
import { createSpinner } from "../utils/spinner.js";
import type { DeploymentStrategy } from "@forge/types";

interface DeployOptions {
  version?: string;
  strategy?: DeploymentStrategy;
}

export function createDeployCommand(): Command {
  return new Command("deploy")
    .description("Deploy a project")
    .argument("[project-id]", "Project ID (uses default if not specified)")
    .option("-v, --version <version>", "Version to deploy")
    .option("-s, --strategy <strategy>", "Deployment strategy", "rolling")
    .action(async (projectId: string | undefined, options: DeployOptions) => {
      try {
        const config = new ConfigManager();
        const client = new ApiClient(config.getApiUrl(), config.getApiKey());

        const id = projectId || config.getDefaultProject();
        if (!id) {
          output.error("Project ID required. Use --project or set a default project.");
          process.exit(1);
        }

        const spinner = createSpinner("Starting deployment...").start();

        const result = await client.deployProject(id, {
          version: options.version,
          strategy: options.strategy,
        });

        spinner.succeed("Deployment started");

        output.newline();
        output.keyValue("Deployment ID", result.deployment.id);
        output.keyValue("Project ID", result.deployment.projectId);
        output.keyValue("Version", result.deployment.version || "latest");
        output.keyValue("Status", result.deployment.status);
        output.newline();

        output.info("Run `forge logs --follow` to view deployment logs");
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Deployment failed");
        process.exit(1);
      }
    });
}
