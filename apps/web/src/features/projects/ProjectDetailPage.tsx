import { useParams, useRouter, Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/shared/components/ui/item";
import {
  LoaderIcon,
  RocketIcon,
  GitForkIcon,
  PackageIcon,
  ActivityIcon,
  ArrowRightIcon,
  SettingsIcon,
  ExternalLinkIcon,
  ZapIcon,
  ClockIcon,
  BoxIcon,
} from "lucide-react";
import { useProject } from "@/core/api/hooks/useProjects";
import { useProjectDeployments, useCreateDeployment } from "@/core/api/hooks/useDeployments";
import { useProjectWithGitIntegration } from "@/core/api/hooks/useProjects";
import { useProjectContainers } from "@/core/api/hooks/useContainers";
import { DeploymentStatus } from "./components/DeploymentStatus";
import { DeploymentProgress } from "./components/DeploymentProgress";
import { DeployConfigModal } from "./components/DeployConfigModal";
import { ContainerStatusBadge } from "@/features/containers/components/ContainerStatusBadge";
import { ContainerActions } from "@/features/containers/components/ContainerActions";
import { DomainsTab } from "./components/DomainsTab";
import { formatDistanceToNow } from "date-fns";
import { useState, useMemo } from "react";
import { ApiClientError } from "@/core/api/client";
import type { Deployment, Project, DeploymentStrategy } from "@forge/types";

function formatTimestamp(timestamp: Date | string | null | undefined): string {
  if (!timestamp) return "Never";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getDeploymentStatusInfo(status: string): {
  label: string;
  category: "success" | "progress" | "error" | "warning" | "neutral";
} {
  const normalized = status.toLowerCase().replace(/_/g, "-");
  if (["running", "healthy"].includes(normalized)) {
    return { label: "Live", category: "success" };
  }
  if (["building", "deploying", "pending", "queued"].includes(normalized)) {
    return { label: "In Progress", category: "progress" };
  }
  if (["failed", "error"].includes(normalized)) {
    return { label: "Failed", category: "error" };
  }
  return { label: "Inactive", category: "neutral" };
}

function formatDeploymentDuration(deployment: {
  buildStartedAt?: Date | string | null | undefined;
  buildCompletedAt?: Date | string | null | undefined;
  deployCompletedAt?: Date | string | null | undefined;
}): string {
  if (!deployment.buildStartedAt) return "-";

  const endTime = deployment.deployCompletedAt ?? deployment.buildCompletedAt ?? new Date();
  const startTime = new Date(deployment.buildStartedAt);
  const end = new Date(endTime);
  const diffMs = end.getTime() - startTime.getTime();

  if (diffMs < 1000) return `${diffMs}ms`;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  return `${diffMins}m ${diffSecs % 60}s`;
}

function mapDockerStatusToDbStatus(
  dockerStatus: string
):
  | "RUNNING"
  | "STOPPED"
  | "CREATING"
  | "STARTING"
  | "STOPPING"
  | "RESTARTING"
  | "ERROR"
  | "TERMINATED" {
  const statusMap: Record<
    string,
    | "RUNNING"
    | "STOPPED"
    | "CREATING"
    | "STARTING"
    | "STOPPING"
    | "RESTARTING"
    | "ERROR"
    | "TERMINATED"
  > = {
    running: "RUNNING",
    exited: "STOPPED",
    created: "CREATING",
    paused: "STOPPED",
    restarting: "RESTARTING",
    removing: "STOPPING",
    dead: "TERMINATED",
  };
  return statusMap[dockerStatus] ?? "ERROR";
}

interface ContainersTabContentProps {
  projectId: string;
  router: ReturnType<typeof useRouter>;
}

function ContainersTabContent({
  projectId,
  router,
}: ContainersTabContentProps): React.ReactElement {
  const { data: containers, isLoading, error } = useProjectContainers(projectId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <LoaderIcon className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs">Loading containers...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-destructive text-xs">Failed to load containers</div>
      </div>
    );
  }

  const totalCount = containers?.length ?? 0;
  const runningCount =
    containers?.filter((c: { status: string }) => c.status === "running").length ?? 0;
  const stoppedCount = totalCount - runningCount;

  const getStatusBarColor = (status: string): string => {
    const normalized = status.toLowerCase();
    if (normalized === "running" || normalized === "healthy") return "bg-primary";
    if (normalized === "exited" || normalized === "stopped") return "bg-muted-foreground";
    if (normalized === "restarting") return "bg-secondary";
    return "bg-destructive";
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-5">
          <div>
            <h2 className="font-serif text-base font-medium">Containers</h2>
            <p className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider mt-0.5">
              {totalCount === 0
                ? "No containers running"
                : `${totalCount} container${totalCount !== 1 ? "s" : ""}`}
            </p>
          </div>
          {totalCount > 0 && (
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                <span className="text-muted-foreground/70">{runningCount} running</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                <span className="text-muted-foreground/70">{stoppedCount} stopped</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {totalCount === 0 ? (
        <div className="border border-dashed rounded-lg py-14 text-center border-border/50">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted/50 mx-auto mb-3">
            <BoxIcon className="h-5 w-5 text-muted-foreground/50" />
          </div>
          <EmptyTitle className="text-sm font-serif">No containers</EmptyTitle>
          <EmptyDescription className="mt-1 text-xs text-muted-foreground/70">
            Containers will be created when you deploy this project
          </EmptyDescription>
        </div>
      ) : (
        <div className="space-y-2.5">
          {containers?.map((container) => {
            const dbStatus = mapDockerStatusToDbStatus(container.status);
            const isRunning = container.status === "running";
            const timeAgo = container.created
              ? formatDistanceToNow(new Date(container.created), { addSuffix: true })
              : "Unknown";

            return (
              <Card
                key={container.id}
                className={`group hover:border-border transition-colors overflow-hidden border-l-4 border-l-${getStatusBarColor(container.status).replace("bg-", "")}`}
                onClick={() =>
                  void router.navigate({
                    to: "/containers/$containerId",
                    params: { containerId: container.id },
                  })
                }
              >
                <CardContent className="p-0">
                  <div className="flex items-stretch">
                    <div
                      className={`w-1 ${getStatusBarColor(container.status)} ${
                        isRunning ? "animate-pulse" : ""
                      }`}
                    />

                    <div className="flex-1 p-3">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0">
                            <BoxIcon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="font-mono text-xs font-medium truncate">
                                {container.name || container.id?.slice(0, 12)}
                              </span>
                              <ContainerStatusBadge status={dbStatus} />
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                              <span className="font-mono">{container.image}</span>
                              <span className="text-border/50">•</span>
                              <span>{timeAgo}</span>
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ContainerActions
                            containerId={container.id}
                            status={dbStatus}
                            onViewDetails={() =>
                              void router.navigate({
                                to: "/containers/$containerId",
                                params: { containerId: container.id },
                              })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DeploymentsTabContentProps {
  project: Project;
  deployments: Deployment[];
  projectId: string;
  router: ReturnType<typeof useRouter>;
  defaultStrategy?: DeploymentStrategy;
}

function DeploymentsTabContent({
  project,
  deployments,
  projectId,
  router,
  defaultStrategy,
}: DeploymentsTabContentProps): React.ReactElement {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createDeployment = useCreateDeployment();
  const { data: projectWithGit } = useProjectWithGitIntegration(project.id);

  const activeDeployment = useMemo(() => {
    return deployments.find((d) =>
      ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(d.status)
    );
  }, [deployments]);

  const defaultBranch = projectWithGit?.gitIntegration?.branch ?? "main";

  const handleQuickDeploy = async (): Promise<void> => {
    setErrorMessage(null);
    try {
      await createDeployment.mutateAsync({
        projectId: project.id,
        strategy: defaultStrategy,
      });
    } catch (err) {
      const error = err as ApiClientError;
      if (error.code === "CONFLICT") {
        setErrorMessage("A deployment is already in progress");
      } else if (error.code === "NOT_FOUND") {
        setErrorMessage("Project not found");
      } else {
        setErrorMessage(error.message || "Failed to start deployment");
      }
    }
  };

  const canDeploy = !activeDeployment && !createDeployment.isPending;

  const getNodeColor = (status: string): string => {
    const info = getDeploymentStatusInfo(status);
    switch (info.category) {
      case "success":
        return "bg-success-500 border-success-400";
      case "progress":
        return "bg-primary border-primary";
      case "error":
        return "bg-destructive border-destructive";
      case "warning":
        return "bg-secondary border-secondary";
      default:
        return "bg-muted-foreground border-muted-foreground";
    }
  };

  const getLineClass = (index: number, total: number, isActive: boolean): string => {
    if (index === total - 1) return "";
    return isActive ? "bg-primary" : "bg-border";
  };

  return (
    <div className="space-y-6">
      <div className="border border-border/50 rounded-lg p-4 bg-muted/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <RocketIcon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-serif text-sm font-medium">Deployment Queue</h3>
              <p className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                {deployments.length === 0
                  ? "No deployments yet"
                  : `${deployments.length} deployment${deployments.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {activeDeployment && (
              <DeploymentStatus status={activeDeployment.status} size="sm" showLabel={true} />
            )}

            <DeployConfigModal
              projectId={project.id}
              defaultBranch={defaultBranch}
              defaultStrategy={defaultStrategy}
              onSuccess={() => setErrorMessage(null)}
            >
              <Button
                disabled={!canDeploy}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs h-8"
              >
                <SettingsIcon className="mr-1 h-3.5 w-3.5" />
                Configure
              </Button>
            </DeployConfigModal>

            <Button
              onClick={() => void handleQuickDeploy()}
              disabled={!canDeploy}
              size="sm"
              className="gap-1.5 text-xs h-8"
            >
              {createDeployment.isPending ? (
                <>
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  Creating...
                </>
              ) : activeDeployment ? (
                <>
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin" />
                  Deploying...
                </>
              ) : (
                <>
                  <RocketIcon className="h-3.5 w-3.5" />
                  Deploy
                </>
              )}
            </Button>
          </div>
        </div>

        {errorMessage && (
          <div className="mt-3 rounded-md bg-destructive/10 p-2.5">
            <p className="text-xs text-destructive">{errorMessage}</p>
          </div>
        )}
      </div>

      {activeDeployment && (
        <Card className="border-primary/20">
          <CardContent className="p-3.5">
            <DeploymentProgress deployment={activeDeployment} projectId={project.id} />
          </CardContent>
        </Card>
      )}

      {deployments.length === 0 ? (
        <div className="border border-dashed rounded-lg py-16 text-center border-border/50">
          <div className="flex items-center justify-center w-12 h-12 rounded-lg bg-muted/50 mx-auto mb-4">
            <RocketIcon className="h-6 w-6 text-muted-foreground/50" />
          </div>
          <EmptyTitle className="text-sm font-serif">No deployments yet</EmptyTitle>
          <EmptyDescription className="mt-1 text-xs text-muted-foreground/70">
            Create your first deployment to get started
          </EmptyDescription>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs">
            <h3 className="font-serif text-sm font-medium">Timeline</h3>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 text-muted-foreground/70 h-7 text-xs"
              onClick={() => void router.navigate({ to: `/projects/${projectId}/deployments` })}
            >
              View all deployments
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="space-y-0">
            {deployments.map((deployment, index) => {
              const statusInfo = getDeploymentStatusInfo(deployment.status);
              const timeAgo = deployment.createdAt
                ? formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })
                : "Unknown";
              const duration = formatDeploymentDuration(deployment);
              const isActive = ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(
                deployment.status
              );

              return (
                <div key={deployment.id} className="relative">
                  <div
                    className={`flex gap-3 pb-6 last:pb-0 group cursor-pointer`}
                    onClick={() =>
                      void router.navigate({
                        to: `/projects/${projectId}/deployments/${deployment.id}`,
                      })
                    }
                  >
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 z-10 transition-transform group-hover:scale-125 ${getNodeColor(deployment.status)} ${
                          isActive ? "animate-pulse" : ""
                        }`}
                      />
                      {index < deployments.length - 1 && (
                        <div
                          className={`w-0.5 flex-1 mt-1.5 min-h-10 ${getLineClass(index, deployments.length, isActive)}`}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 pt-0.5">
                      <div
                        className={`border rounded-lg p-3 transition-colors ${
                          isActive
                            ? "border-primary/20 bg-primary/5"
                            : "border-border/50 group-hover:border-border"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <code className="text-xs font-mono font-medium">
                                {deployment.id.slice(0, 8)}
                              </code>
                              <Badge
                                variant="outline"
                                className={`font-mono text-[10px] uppercase tracking-wider ${
                                  statusInfo.category === "success"
                                    ? "border-success-500/50 text-success-500"
                                    : statusInfo.category === "progress"
                                      ? "border-primary/50 text-primary"
                                      : statusInfo.category === "error"
                                        ? "border-destructive/50 text-destructive"
                                        : ""
                                }`}
                              >
                                {statusInfo.label}
                              </Badge>
                              {deployment.strategy && (
                                <Badge
                                  variant="outline"
                                  className="font-mono text-[10px] uppercase tracking-wider"
                                >
                                  {deployment.strategy.replace("_", "-")}
                                </Badge>
                              )}
                            </div>

                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground/70">
                              <span className="flex items-center gap-1">
                                <ClockIcon className="h-2.5 w-2.5" />
                                {timeAgo}
                              </span>
                              {duration !== "-" && (
                                <>
                                  <span className="text-border/50">•</span>
                                  <span className="flex items-center gap-1">
                                    <ActivityIcon className="h-2.5 w-2.5" />
                                    {duration}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          <ArrowRightIcon className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-muted-foreground transition-colors shrink-0" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProjectDetailPage(): React.ReactElement {
  const { projectId } = useParams({ from: "/authenticated/projects/$projectId" });
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);

  const { data: deployments = [], isLoading: deploymentsLoading } =
    useProjectDeployments(projectId);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-2 text-muted-foreground/70">
          <LoaderIcon className="h-4 w-4 animate-spin text-primary" />
          <span className="text-xs">Loading project...</span>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-destructive text-xs">
          {projectError ? "Failed to load project" : "Project not found"}
        </div>
      </div>
    );
  }

  const config = (project.config as Record<string, unknown> | undefined) || {};
  const buildConfig = (config.build as Record<string, unknown> | undefined) || {};
  const deployConfig = (config.deploy as Record<string, unknown> | undefined) || {};
  const framework = buildConfig.framework as string | undefined;
  const defaultStrategy = deployConfig.strategy as DeploymentStrategy | undefined;
  const repository = project.sourceUrl || "No repository configured";
  const createdAt = formatTimestamp(project.createdAt);
  const updatedAt = formatTimestamp(project.updatedAt);
  const description = (project.metadata as Record<string, unknown> | undefined)?.description as
    | string
    | undefined;

  return (
    <div className="space-y-6">
      <Breadcrumb className="text-xs">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink
              asChild
              className="font-mono text-muted-foreground/70 uppercase tracking-wider hover:text-foreground/80 transition-colors"
            >
              <Link to="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator className="text-border/50" />
          <BreadcrumbItem>
            <BreadcrumbPage className="font-mono text-foreground/70 uppercase tracking-wider">
              {project.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="border border-border/50 rounded-lg bg-muted/20">
        <div className="flex items-center justify-between gap-6 px-4 py-3">
          <div className="flex items-center gap-5">
            {deployments.length > 0 ? (
              <>
                <div className="flex items-center gap-2.5">
                  <div className="relative flex items-center justify-center">
                    {["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(
                      deployments[0].status
                    ) && (
                      <div className="absolute h-3.5 w-3.5 rounded-full bg-primary/20 animate-ping" />
                    )}
                    <div
                      className={`relative h-2 w-2 rounded-full ${
                        ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(
                          deployments[0].status
                        )
                          ? "bg-primary"
                          : deployments[0].status === "SUCCEEDED" ||
                              deployments[0].status === "RUNNING"
                            ? "bg-success-500"
                            : "bg-destructive"
                      } ${
                        ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(
                          deployments[0].status
                        )
                          ? "animate-pulse"
                          : ""
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[9px] text-muted-foreground/70 uppercase tracking-wider">
                      Status
                    </span>
                    <span className="text-xs font-medium">
                      {getDeploymentStatusInfo(deployments[0].status).label}
                    </span>
                  </div>
                </div>

                <div className="h-6 w-px bg-border/50" />

                <div className="hidden sm:flex items-center gap-3 text-[10px] font-mono text-muted-foreground/80">
                  <span>
                    LAST{" "}
                    {deployments[0].createdAt
                      ? formatDistanceToNow(new Date(deployments[0].createdAt), {
                          addSuffix: true,
                        })
                      : "—"}
                  </span>
                  <span className="text-border/50">•</span>
                  <span>ID {deployments[0].id.slice(0, 8)}</span>
                  <span className="text-border/50">•</span>
                  <span>{deployments.length} TOTAL</span>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                <span className="text-xs text-muted-foreground/70">No deployments</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden md:inline font-mono text-[9px] text-muted-foreground/60 uppercase tracking-wider">
              {project.name}
            </span>
            <div className="h-4 w-px bg-border/50 hidden md:block" />
            <Button
              size="sm"
              className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs"
              onClick={() => setActiveTab("deployments")}
            >
              <RocketIcon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deploy</span>
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-foreground h-8 w-8"
              onClick={() => void router.navigate({ to: `/projects/${project.id}/settings` })}
            >
              <SettingsIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="domains">Domains</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2 border-border/50">
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="font-serif text-2xl font-semibold tracking-tight">
                      {project.name}
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {framework && (
                      <Badge
                        variant="outline"
                        className="font-mono text-[10px] uppercase tracking-wider px-2 py-0.5"
                      >
                        {framework}
                      </Badge>
                    )}
                  </div>
                </div>
                <CardDescription className="text-sm mt-2 text-muted-foreground/80">
                  {description || "No description provided"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => setActiveTab("deployments")}
                  >
                    <RocketIcon className="h-3.5 w-3.5" />
                    New Deployment
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs h-8"
                    onClick={() => void router.navigate({ to: `/projects/${project.id}/settings` })}
                  >
                    <SettingsIcon className="h-3.5 w-3.5" />
                    Configure
                  </Button>
                  {repository !== "No repository configured" && (
                    <Button size="sm" variant="ghost" className="gap-1.5 text-xs h-8" asChild>
                      <a
                        href={repository.startsWith("http") ? repository : undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLinkIcon className="h-3.5 w-3.5" />
                        View Repository
                      </a>
                    </Button>
                  )}
                </div>

                <div className="flex flex-wrap gap-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                    <ClockIcon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">Created {createdAt}</span>
                  </div>
                  {updatedAt !== "Never" && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-muted/50">
                      <ActivityIcon className="h-3 w-3 text-muted-foreground" />
                      <span className="text-xs">Updated {updatedAt}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-sm">Latest Deployment</CardTitle>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Status
                </CardDescription>
                {deployments.length > 0 ? (
                  <div className="flex items-center gap-2">
                    <DeploymentStatus status={deployments[0].status} size="sm" showLabel={true} />
                  </div>
                ) : (
                  <span className="text-sm text-muted-foreground/70">No deployments</span>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex items-center justify-center">
                {deployments.length > 0 ? (
                  <div className="w-full space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono text-[10px] text-muted-foreground/70 uppercase">
                        ID
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {deployments[0].id.slice(0, 12)}
                      </span>
                    </div>
                    {deployments[0].strategy && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[10px] text-muted-foreground/70 uppercase">
                          Strategy
                        </span>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px] uppercase tracking-wider"
                        >
                          {deployments[0].strategy.replace("_", "-")}
                        </Badge>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-4">
                    <ZapIcon className="h-7 w-7 text-muted-foreground/40 mb-2" />
                    <p className="text-xs text-muted-foreground/70">Create your first deployment</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {deployments.length > 0 && (
            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="font-serif">Recent Activity</CardTitle>
                    <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                      Latest Deployments
                    </CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() =>
                      void router.navigate({ to: `/projects/${project.id}/deployments` })
                    }
                  >
                    View All
                    <ArrowRightIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <ItemGroup>
                  {deployments.slice(0, 4).map((deployment) => {
                    const statusInfo = getDeploymentStatusInfo(deployment.status);
                    const timeAgo = deployment.createdAt
                      ? formatDistanceToNow(new Date(deployment.createdAt), { addSuffix: true })
                      : "Unknown";

                    const iconColor =
                      statusInfo.category === "success"
                        ? "text-emerald-500"
                        : statusInfo.category === "progress"
                          ? "text-primary"
                          : statusInfo.category === "error"
                            ? "text-destructive"
                            : "text-muted-foreground";

                    const badgeClass =
                      statusInfo.category === "success"
                        ? "border-emerald-500/50 text-emerald-500"
                        : statusInfo.category === "progress"
                          ? "border-primary/50 text-primary"
                          : statusInfo.category === "error"
                            ? "border-destructive/50 text-destructive"
                            : "";

                    return (
                      <Item
                        key={deployment.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() =>
                          void router.navigate({
                            to: `/projects/${project.id}/deployments/${deployment.id}`,
                          })
                        }
                      >
                        <ItemMedia variant="icon">
                          <RocketIcon className={`h-4 w-4 ${iconColor}`} />
                        </ItemMedia>
                        <ItemContent>
                          <ItemTitle>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-sm">{deployment.id.slice(0, 8)}</span>
                              <Badge variant="outline" className={badgeClass}>
                                {statusInfo.label}
                              </Badge>
                            </div>
                          </ItemTitle>
                          <ItemDescription>
                            <div className="flex items-center gap-3">
                              <span>{timeAgo}</span>
                              {deployment.strategy && (
                                <>
                                  <span className="text-border">•</span>
                                  <span className="capitalize">
                                    {deployment.strategy.replace("_", "-")}
                                  </span>
                                </>
                              )}
                            </div>
                          </ItemDescription>
                        </ItemContent>
                        <ItemActions>
                          <Button variant="ghost" size="icon-sm" className="shrink-0">
                            <ArrowRightIcon className="h-4 w-4" />
                          </Button>
                        </ItemActions>
                      </Item>
                    );
                  })}
                </ItemGroup>
              </CardContent>
            </Card>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {repository !== "No repository configured" && (
              <Card className="border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="font-serif text-base flex items-center gap-2">
                    <GitForkIcon className="h-4 w-4 text-muted-foreground" />
                    Source Repository
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="font-mono text-xs break-all text-muted-foreground/80">
                    {repository}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs h-8"
                    asChild
                  >
                    <a
                      href={repository.startsWith("http") ? repository : undefined}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLinkIcon className="h-3.5 w-3.5" />
                      Open in Git
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="border-border/50">
              <CardHeader className="pb-3">
                <CardTitle className="font-serif text-base flex items-center gap-2">
                  <PackageIcon className="h-4 w-4 text-muted-foreground" />
                  Project Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1">
                  <p className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                    Project ID
                  </p>
                  <p className="font-mono text-xs text-muted-foreground">{project.id}</p>
                </div>
                {framework && (
                  <div className="space-y-1">
                    <p className="font-mono text-[10px] text-muted-foreground/70 uppercase tracking-wider">
                      Framework
                    </p>
                    <p className="text-xs">{framework}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {deployments.length === 0 && (
            <Card className="border-dashed border-border/50">
              <CardContent className="py-12">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="flex items-center justify-center w-14 h-14 rounded-full bg-muted/50">
                    <RocketIcon className="h-6 w-6 text-muted-foreground/60" />
                  </div>
                  <div>
                    <EmptyTitle className="font-serif">Ready to Deploy</EmptyTitle>
                    <EmptyDescription className="mt-1 text-sm text-muted-foreground/70">
                      Your project is configured and ready. Create your first deployment to go live.
                    </EmptyDescription>
                  </div>
                  <Button
                    size="sm"
                    className="gap-1.5 text-xs h-8"
                    onClick={() =>
                      void router.navigate({ to: `/projects/${project.id}/deployments` })
                    }
                  >
                    <RocketIcon className="h-3.5 w-3.5" />
                    Create First Deployment
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="services">
          <Empty>
            <EmptyHeader>
              <EmptyTitle>No services configured</EmptyTitle>
              <EmptyDescription>
                Services will be created when you deploy your project
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        </TabsContent>

        <TabsContent value="deployments" className="space-y-6">
          {deploymentsLoading ? (
            <Card className="border-border/50">
              <CardContent className="flex items-center justify-center py-16">
                <div className="flex items-center gap-2 text-muted-foreground/70">
                  <LoaderIcon className="h-4 w-4 animate-spin text-primary" />
                  <span className="text-xs">Loading deployments...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <DeploymentsTabContent
              project={project}
              deployments={deployments}
              projectId={projectId}
              router={router}
              defaultStrategy={defaultStrategy}
            />
          )}
        </TabsContent>

        <TabsContent value="containers" className="space-y-6">
          <ContainersTabContent projectId={projectId} router={router} />
        </TabsContent>

        <TabsContent value="domains" className="space-y-6">
          <DomainsTab project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
