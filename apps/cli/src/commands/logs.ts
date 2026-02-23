import { Command } from "commander";
import chalk from "chalk";
import { ApiClient } from "../client/api.js";
import { ConfigManager } from "../config/manager.js";
import { output } from "../utils/output.js";
import type { Log, LogLevel } from "@forge/types";

interface LogsOptions {
  follow?: boolean;
  lines?: string;
  since?: string;
  level?: LogLevel;
}

export function createLogsCommand(): Command {
  return new Command("logs")
    .description("View project logs")
    .argument("[project-id]", "Project ID (uses default if not specified)")
    .option("-f, --follow", "Follow log output")
    .option("-n, --lines <number>", "Number of lines to show", "100")
    .option("--since <time>", "Show logs since timestamp")
    .option("--level <level>", "Filter by log level")
    .action(async (projectId: string | undefined, options: LogsOptions) => {
      try {
        const config = new ConfigManager();
        const client = new ApiClient(config.getApiUrl(), config.getApiKey());

        const id = projectId || config.getDefaultProject();
        if (!id) {
          output.error("Project ID required");
          process.exit(1);
        }

        const limit = parseInt(options.lines ?? "100", 10);

        if (isNaN(limit) || limit < 1) {
          output.error("Invalid lines value");
          process.exit(1);
        }

        const result = await client.getLogs({
          projectId: id,
          since: options.since,
          limit,
        });

        result.logs.forEach((log: Log) => {
          printLog(log);
        });

        // TODO: Implement follow mode with WebSocket
        if (options.follow) {
          output.info("Follow mode not yet implemented");
        }
      } catch (error) {
        output.error(error instanceof Error ? error.message : "Failed to fetch logs");
        process.exit(1);
      }
    });
}

function printLog(log: Log): void {
  const timestamp = chalk.gray(new Date(log.timestamp).toISOString());
  const level = formatLogLevel(log.level);
  const source = chalk.cyan(`[${log.sourceName}]`);
  const message = log.message;

  console.log(`${timestamp} ${level} ${source} ${message}`);
}

function formatLogLevel(level: LogLevel): string {
  const colors: Record<LogLevel, (text: string) => string> = {
    TRACE: chalk.gray,
    DEBUG: chalk.blue,
    INFO: chalk.green,
    WARN: chalk.yellow,
    ERROR: chalk.red,
    FATAL: chalk.red.bold,
  };

  const formatter = colors[level] ?? chalk.white;
  return formatter(level.padEnd(5));
}
