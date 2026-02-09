import { Command } from "commander";
import inquirer from "inquirer";
import { ApiClient } from "../../client/api.js";
import { ConfigManager } from "../../config/manager.js";
import { output } from "../../utils/output.js";
import { withSpinner } from "../../utils/spinner.js";

interface DeleteOptions {
  force?: boolean;
}

interface ConfirmAnswers {
  confirm: boolean;
}

export function createDeleteCommand(): Command {
  return new Command("delete")
    .alias("rm")
    .description("Delete a project")
    .argument("<id>", "Project ID")
    .option("-f, --force", "Skip confirmation")
    .action(async (id: string, options: DeleteOptions) => {
      if (!id || id.trim().length === 0) {
        output.error("Project ID is required");
        process.exit(1);
      }

      try {
        const config = new ConfigManager();
        const client = new ApiClient(config.getApiUrl(), config.getApiKey());

        if (!options.force) {
          const { confirm } = await inquirer.prompt<ConfirmAnswers>([
            {
              type: "confirm",
              name: "confirm",
              message: `Are you sure you want to delete project ${id}?`,
              default: false,
            },
          ]);

          if (!confirm) {
            output.info("Deletion cancelled");
            return;
          }
        }

        await withSpinner("Deleting project...", () => client.deleteProject(id));

        output.success("Project deleted successfully");
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to delete project");
        process.exit(1);
      }
    });
}
