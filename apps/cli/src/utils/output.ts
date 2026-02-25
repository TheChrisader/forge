import chalk from "chalk";
import { table } from "table";
import type { Project, Deployment, Service } from "@forge/types";
import { formatDistanceToNow } from "date-fns";

export const output = {
  success(message: string): void {
    console.log(chalk.green("✓"), message);
  },

  error(message: string): void {
    console.log(chalk.red("✗"), message);
  },

  info(message: string): void {
    console.log(chalk.blue("ℹ"), message);
  },

  warning(message: string): void {
    console.log(chalk.yellow("⚠"), message);
  },

  section(title: string): void {
    console.log();
    console.log(chalk.bold.underline(title));
    console.log();
  },

  keyValue(key: string, value: string): void {
    console.log(chalk.gray(key + ":"), value);
  },

  newline(): void {
    console.log();
  },
};

export function formatRelativeTime(date: Date): string {
  return formatDistanceToNow(date, { addSuffix: true });
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

export function formatStatus(status: string): string {
  const statusColors: Record<string, (text: string) => string> = {
    active: chalk.green,
    running: chalk.green,
    healthy: chalk.green,
    completed: chalk.green,
    inactive: chalk.gray,
    stopped: chalk.gray,
    archived: chalk.dim,
    pending: chalk.yellow,
    building: chalk.yellow,
    deploying: chalk.yellow,
    starting: chalk.yellow,
    error: chalk.red,
    failed: chalk.red,
    unhealthy: chalk.red,
  };

  const formatter = statusColors[status.toLowerCase()] || chalk.white;
  return formatter(status);
}

export function printProjectsTable(projects: Project[]): void {
  if (projects.length === 0) {
    output.info("No projects found");
    return;
  }

  const data = [
    ["ID", "Name", "Type", "Status", "Created"].map((h) => chalk.bold(h)),
    ...projects.map((p) => [
      p.id.substring(0, 8),
      p.name,
      p.type || "-",
      formatStatus(p.status),
      formatRelativeTime(p.createdAt),
    ]),
  ];

  console.log(table(data));
}

export function printDeploymentsTable(deployments: Deployment[]): void {
  if (deployments.length === 0) {
    output.info("No deployments found");
    return;
  }

  const data = [
    ["ID", "Version", "Status", "Created"].map((h) => chalk.bold(h)),
    ...deployments.map((d) => [
      d.id.substring(0, 8),
      d.version,
      formatStatus(d.status),
      formatRelativeTime(d.createdAt),
    ]),
  ];

  console.log(table(data));
}

export function printServicesTable(services: Service[]): void {
  if (services.length === 0) {
    output.info("No services found");
    return;
  }

  const data = [
    ["ID", "Name", "Type", "Engine", "Status"].map((h) => chalk.bold(h)),
    ...services.map((s) => [
      s.id.substring(0, 8),
      s.name,
      s.type,
      s.engine || "-",
      formatStatus(s.status),
    ]),
  ];

  console.log(table(data));
}

export function printProjectDetails(project: Project): void {
  output.section("Project Details");
  output.keyValue("ID", project.id);
  output.keyValue("Name", project.name);
  output.keyValue("Type", project.type || "-");
  output.keyValue("Status", formatStatus(project.status));
  output.keyValue("Created", formatRelativeTime(project.createdAt));
  output.keyValue("Updated", formatRelativeTime(project.updatedAt));

  if (project.createdBy) {
    output.keyValue("Created By", project.createdBy);
  }

  output.newline();
}
