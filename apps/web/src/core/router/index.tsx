import { createRouter, createRoute, createRootRoute } from "@tanstack/react-router";
import { RootLayout } from "@/shared/components/layout";
import { DashboardPage } from "@/features/dashboard";
import { ProjectsPage, ProjectDetailPage, ProjectSettingsPage } from "@/features/projects";
import { ServicesPage } from "@/features/services";
import { DeploymentsPage, DeploymentLogsPage } from "@/features/deployments";
import { LogsPage } from "@/features/logging";
import { MetricsPage } from "@/features/metrics";
import { SettingsPage } from "@/features/settings";
import { NotFoundPage } from "@/shared/components/NotFoundPage";

const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects",
  component: ProjectsPage,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId",
  component: ProjectDetailPage,
});

const deploymentLogsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/deployments/$deploymentId",
  component: DeploymentLogsPage,
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/projects/$projectId/settings",
  component: ProjectSettingsPage,
});

const servicesRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/services",
  component: ServicesPage,
});

const deploymentsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/deployments",
  component: DeploymentsPage,
});

const logsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/logs",
  component: LogsPage,
});

const metricsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/metrics",
  component: MetricsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/settings",
  component: SettingsPage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "*",
  component: NotFoundPage,
});

const routeTree = rootRoute.addChildren([
  indexRoute,
  projectsRoute,
  projectDetailRoute,
  deploymentLogsRoute,
  projectSettingsRoute,
  servicesRoute,
  deploymentsRoute,
  logsRoute,
  metricsRoute,
  settingsRoute,
  notFoundRoute,
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
