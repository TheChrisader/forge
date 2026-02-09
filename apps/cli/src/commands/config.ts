import { Command } from "commander";
import { ConfigManager } from "../config/manager.js";
import { output } from "../utils/output.js";

export function createConfigCommand(): Command {
  const config = new Command("config").description("Manage CLI configuration");

  config
    .command("get")
    .description("Show current configuration")
    .action(() => {
      const manager = new ConfigManager();
      const config = manager.getConfig();

      output.section("Current Configuration");
      output.keyValue("API URL", config.apiUrl);
      output.keyValue("API Key", config.apiKey ? "***" : "Not set");
      output.keyValue("Default Project", config.defaultProject || "Not set");
      output.newline();
    });

  config
    .command("set-url")
    .description("Set API URL")
    .argument("<url>", "API URL")
    .action((url: string) => {
      if (!url || url.trim().length === 0) {
        output.error("URL is required");
        process.exit(1);
      }

      try {
        const manager = new ConfigManager();
        manager.setApiUrl(url);
        output.success(`API URL set to: ${url}`);
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to set API URL");
        process.exit(1);
      }
    });

  config
    .command("set-key")
    .description("Set API key")
    .argument("<key>", "API key")
    .action((key: string) => {
      if (!key || key.trim().length === 0) {
        output.error("API key is required");
        process.exit(1);
      }

      try {
        const manager = new ConfigManager();
        manager.setApiKey(key);
        output.success("API key configured");
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to set API key");
        process.exit(1);
      }
    });

  config
    .command("set-project")
    .description("Set default project")
    .argument("<id>", "Project ID")
    .action((id: string) => {
      if (!id || id.trim().length === 0) {
        output.error("Project ID is required");
        process.exit(1);
      }

      try {
        const manager = new ConfigManager();
        manager.setDefaultProject(id);
        output.success(`Default project set to: ${id}`);
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to set default project");
        process.exit(1);
      }
    });

  return config;
}
