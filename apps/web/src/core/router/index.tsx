import { createRouter, createRoute, createRootRoute, Outlet } from "@tanstack/react-router";
import { RootLayout } from "@/shared/components/layout";
import { DashboardPage } from "@/features/dashboard";
import { ProjectsPage, ProjectDetailPage, ProjectSettingsPage } from "@/features/projects";
import { ServicesPage, ServiceDetailPage } from "@/features/services";
import { DeploymentsPage, DeploymentLogsPage } from "@/features/deployments";
import { ActivityPage } from "@/features/activity";
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

const projectDetailTabValues = [
  "overview",
  "services",
  "deployments",
  "containers",
  "domains",
] as const;
type ProjectDetailTab = (typeof projectDetailTabValues)[number];

const projectDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects/$projectId",
  validateSearch: ({ tab }: Record<string, unknown>): { tab?: ProjectDetailTab } => {
    if (tab && projectDetailTabValues.includes(tab as ProjectDetailTab)) {
      return { tab: tab as ProjectDetailTab };
    }
    return {};
  },
  component: ProjectDetailPage,
});

const deploymentLogsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects/$projectId/deployments/$deploymentId",
  component: DeploymentLogsPage,
});

const projectDeploymentsRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/projects/$projectId/deployments",
  component: DeploymentsPage,
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

const serviceDetailRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/services/$serviceId",
  component: ServiceDetailPage,
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

const activityRoute = createRoute({
  getParentRoute: () => authenticatedRoute,
  path: "/activity",
  component: ActivityPage,
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
    projectDeploymentsRoute,
    projectSettingsRoute,
    servicesRoute,
    serviceDetailRoute,
    imagesRoute,
    containerDetailRoute,
    containerLogsRoute,
    activityRoute,
    metricsRoute,
    settingsRoute,
    notFoundRoute,
  ]),
]);

export const router = createRouter({ routeTree, disableGlobalCatchBoundary: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
