import { Command } from "commander";
import { createListCommand } from "./list.js";
import { createCreateCommand } from "./create.js";
import { createGetCommand } from "./get.js";
import { createDeleteCommand } from "./delete.js";

export function createProjectsCommand(): Command {
  const projects = new Command("projects").alias("project").description("Manage projects");

  projects.addCommand(createListCommand());
  projects.addCommand(createCreateCommand());
  projects.addCommand(createGetCommand());
  projects.addCommand(createDeleteCommand());

  return projects;
}
