import { Command } from "commander";
import { ApiClient } from "../../client/api.js";
import { ConfigManager } from "../../config/manager.js";
import { output, printProjectDetails } from "../../utils/output.js";

export function createGetCommand(): Command {
  return new Command("get")
    .description("Get project details")
    .argument("<id>", "Project ID")
    .action(async (id: string) => {
      if (!id || id.trim().length === 0) {
        output.error("Project ID is required");
        process.exit(1);
      }

      try {
        const config = new ConfigManager();
        const client = new ApiClient(config.getApiUrl(), config.getApiKey());

        const result = await client.getProject(id);

        printProjectDetails(result.project);
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to get project");
        process.exit(1);
      }
    });
}
