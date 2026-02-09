#!/usr/bin/env node

import { Command } from "commander";
import { createProjectsCommand } from "./commands/projects/index.js";
import { createDeployCommand } from "./commands/deploy.js";
import { createLogsCommand } from "./commands/logs.js";
import { createConfigCommand } from "./commands/config.js";

const program = new Command();

program
  .name("forge")
  .description("Forge - Local application deployment platform")
  .version("0.1.0")
  .option("-v, --verbose", "Enable verbose output");

program.addCommand(createProjectsCommand());
program.addCommand(createDeployCommand());
program.addCommand(createLogsCommand());
program.addCommand(createConfigCommand());

program.parse();
