import { Command } from "commander";
import { ApiClient } from "../client/api.js";
import { formatBytes, output } from "../utils/output.js";
import { table } from "table";
import chalk from "chalk";

export function createImagesCommand(): Command {
  const cmd = new Command("images");

  cmd
    .command("list")
    .option("-p, --project <id>", "Filter by project ID")
    .option("--dangling", "Show only dangling images")
    .description("List all Docker images")
    .action(async (options) => {
      const client = new ApiClient(process.env.FORGE_API_URL ?? "http://localhost:3000");
      const response = await client.http.get("/images", {
        params: { project: options.project, dangling: options.dangling },
      });

      const images = response.data;

      if (images.length === 0) {
        output.info("No images found");
        return;
      }

      const data = [
        ["ID", "Tags", "Size", "Created"].map((h) => chalk.bold(h)),
        ...images.map((img: Record<string, unknown>) => [
          String(img.id).slice(7, 19),
          ((img.repoTags as string[]) || []).join(", ") || chalk.gray("<none>"),
          formatBytes((img.size as number) || 0),
          img.created ? new Date(img.created as string).toLocaleString() : "N/A",
        ]),
      ];

      console.log(table(data));
      console.log(`\nTotal: ${images.length} images`);
    });

  cmd
    .command("stats")
    .option("-p, --project <id>", "Filter by project ID")
    .description("Show image disk usage statistics")
    .action(async (options) => {
      const client = new ApiClient(process.env.FORGE_API_URL ?? "http://localhost:3000");
      const response = await client.http.get("/images/stats", {
        params: { project: options.project },
      });

      console.log(`Images: ${chalk.bold(response.data.count)}`);
      console.log(`Total disk usage: ${chalk.bold(formatBytes(response.data.totalBytes))}`);
    });

  cmd
    .command("delete <id>")
    .option("-f, --force", "Force delete even if in use")
    .description("Delete an image")
    .action(async (id, options) => {
      const client = new ApiClient(process.env.FORGE_API_URL ?? "http://localhost:3000");
      await client.http.delete(`/images/${id}`, {
        params: { force: options.force },
      });

      console.log(chalk.green(`✓ Image ${id} deleted`));
    });

  cmd
    .command("prune")
    .description("Prune dangling images")
    .action(async () => {
      const client = new ApiClient(process.env.FORGE_API_URL ?? "http://localhost:3000");
      const response = await client.http.post("/images/prune");

      console.log(chalk.green(`✓ Deleted ${response.data.deleted.length} images`));
      console.log(chalk.green(`✓ Freed ${formatBytes(response.data.reclaimedBytes)}`));
    });

  cmd
    .command("prune-old <projectId>")
    .option("-d, --days <number>", "Maximum age in days", "30")
    .description("Prune old images for a project")
    .action(async (projectId, options) => {
      const client = new ApiClient(process.env.FORGE_API_URL ?? "http://localhost:3000");
      const maxAgeDays = parseInt(options.days, 10);

      const response = await client.http.post(`/projects/${projectId}/images/prune`, {
        maxAgeDays,
      });

      console.log(chalk.green(`✓ Deleted ${response.data.deleted.length} images`));
      console.log(chalk.green(`✓ Freed ${formatBytes(response.data.reclaimedBytes)}`));

      if (response.data.errors?.length > 0) {
        console.log(chalk.yellow("\nWarnings:"));
        for (const err of response.data.errors) {
          console.log(chalk.gray(`  - ${err}`));
        }
      }
    });

  return cmd;
}
