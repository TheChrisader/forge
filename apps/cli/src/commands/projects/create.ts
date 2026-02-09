import { Command } from "commander";
import inquirer from "inquirer";
import { ApiClient } from "../../client/api.js";
import { ConfigManager } from "../../config/manager.js";
import { output } from "../../utils/output.js";
import { withSpinner } from "../../utils/spinner.js";

interface CreateOptions {
  name?: string;
  type?: string;
  interactive?: boolean;
}

interface CreateAnswers {
  name: string;
  type: string;
}

export function createCreateCommand(): Command {
  return new Command("create")
    .description("Create a new project")
    .option("-n, --name <name>", "Project name")
    .option("-t, --type <type>", "Project type")
    .option("--no-interactive", "Disable interactive mode")
    .action(async (options: CreateOptions) => {
      try {
        const config = new ConfigManager();
        const client = new ApiClient(config.getApiUrl(), config.getApiKey());

        let name = options.name;
        let type = options.type;

        if (!name && options.interactive !== false) {
          const answers = await inquirer.prompt<CreateAnswers>([
            {
              type: "input",
              name: "name",
              message: "Project name:",
              validate: (input: string): boolean | string => input.length > 0 || "Name is required",
            },
            {
              type: "list",
              name: "type",
              message: "Project type:",
              choices: [
                { name: "Node.js", value: "nodejs" },
                { name: "Python", value: "python" },
                { name: "Go", value: "go" },
                { name: "Rust", value: "rust" },
                { name: "Static Site", value: "static" },
                { name: "Docker", value: "docker" },
              ],
            },
          ]);

          name = answers.name;
          type = answers.type;
        }

        if (!name) {
          output.error("Project name is required. Use --name or run without --no-interactive");
          process.exit(1);
        }

        const result = await withSpinner("Creating project...", () =>
          client.createProject({ name, type })
        );

        output.success(`Project created: ${result.project.name} (${result.project.id})`);
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to create project");
        process.exit(1);
      }
    });
}
