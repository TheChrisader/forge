import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import { RootLayout } from "@/shared/components/layout";
import { DashboardPage } from "@/features/dashboard";
import { ProjectsPage, ProjectDetailPage, ProjectSettingsPage } from "@/features/projects";
import { ServicesPage } from "@/features/services";
import { DeploymentsPage, DeploymentLogsPage } from "@/features/deployments";
import { LogsPage } from "@/features/logging";
import { MetricsPage } from "@/features/metrics";
import { SettingsPage } from "@/features/settings";
import { ImagesPage } from "@/features/images";
import { ContainerDetailPage, ContainerLogsPage } from "@/features/containers";
import { NotFoundPage } from "@/shared/components/NotFoundPage";
import { AuthProvider, ProtectedRoute } from "@/core/auth";
import { LoginPage } from "@/features/auth";

const rootRoute = createRootRoute({
  component: () => (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  ),
});

const publicRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "public",
  component: Outlet,
});

const loginRoute = createRoute({
  getParentRoute: () => publicRoute,
  path: "/login",
  component: LoginPage,
});

const authenticatedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "authenticated",
  component: () => (
    <ProtectedRoute>
      <RootLayout />
    </ProtectedRoute>
  ),
});

const indexRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/",
  component: DashboardPage,
});

const projectsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects",
  component: ProjectsPage,
});

const projectDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects/$projectId",
  component: ProjectDetailPage,
});

const deploymentLogsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects/$projectId/deployments/$deploymentId",
  component: DeploymentLogsPage,
});

const projectSettingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects/$projectId/settings",
  component: ProjectSettingsPage,
});

const servicesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/services",
  component: ServicesPage,
});

const deploymentsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/deployments",
  component: DeploymentsPage,
});

const imagesRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/images",
  component: ImagesPage,
});

const containerDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/containers/$containerId",
  component: ContainerDetailPage,
});

const containerLogsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/containers/$containerId/logs",
  component: ContainerLogsPage,
});

const logsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/logs",
  component: LogsPage,
});

const metricsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/metrics",
  component: MetricsPage,
});

const settingsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/settings",
  component: SettingsPage,
});

const notFoundRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "*",
  component: NotFoundPage,
});

const routeTree = rootRoute.addChildren([
  publicRoute.addChildren([loginRoute]),
  authenticatedRoute.addChildren([
    indexRoute,
    projectsRoute,
    projectDetailRoute,
    deploymentLogsRoute,
    projectSettingsRoute,
    servicesRoute,
    deploymentsRoute,
    imagesRoute,
    containerDetailRoute,
    containerLogsRoute,
    logsRoute,
    metricsRoute,
    settingsRoute,
    notFoundRoute,
  ]),
]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
