import { Command } from "commander";
import { ApiClient } from "../../client/api.js";
import { ConfigManager } from "../../config/manager.js";
import { output, printProjectsTable } from "../../utils/output.js";

interface ListOptions {
  page?: string;
  limit?: string;
}

export function createListCommand(): Command {
  return new Command("list")
    .alias("ls")
    .description("List all projects")
    .option("-p, --page <number>", "Page number", "1")
    .option("-l, --limit <number>", "Items per page", "20")
    .action(async (options: ListOptions) => {
      try {
        const config = new ConfigManager();
        const client = new ApiClient(config.getApiUrl(), config.getApiKey());

        const page = parseInt(options.page ?? "1", 10);
        const limit = parseInt(options.limit ?? "20", 10);

        if (isNaN(page) || page < 1) {
          output.error("Invalid page number");
          process.exit(1);
        }

        if (isNaN(limit) || limit < 1 || limit > 100) {
          output.error("Invalid limit (must be between 1 and 100)");
          process.exit(1);
        }

        const response = await client.getProjects({ page, limit });

        printProjectsTable(response.data);

        if (response.meta) {
          output.newline();
          output.info(
            `Showing ${response.data.length} of ${response.meta.total} projects (Page ${response.meta.page}/${response.meta.totalPages})`
          );
        }
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to list projects");
        process.exit(1);
      }
    });
}
