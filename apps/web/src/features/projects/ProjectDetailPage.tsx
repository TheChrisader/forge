import { useParams, useRouter } from "@tanstack/react-router";
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
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { LoaderIcon } from "lucide-react";
import { useProject } from "@/core/api/hooks/useProjects";
import { useProjectDeployments } from "@/core/api/hooks/useDeployments";
import { DeploymentSection } from "./components/DeploymentSection";
import { mapProjectStatusToServiceStatus } from "@/shared/lib/utils";
import { ContainersPage } from "@/features/containers";

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

export function ProjectDetailPage(): React.ReactElement {
  const { projectId } = useParams({ from: "/authenticated/projects/$projectId" });
  const router = useRouter();

  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);

  const { data: deployments = [], isLoading: deploymentsLoading } =
    useProjectDeployments(projectId);

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span>Loading project...</span>
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-destructive">
          {projectError ? "Failed to load project" : "Project not found"}
        </div>
      </div>
    );
  }

  const framework = (project.config as Record<string, unknown> | undefined)?.framework as
    | string
    | undefined;
  const repository = project.sourceUrl || "No repository configured";
  const createdAt = formatTimestamp(project.createdAt);
  const updatedAt = formatTimestamp(project.updatedAt);
  const description = (project.metadata as Record<string, unknown> | undefined)?.description as
    | string
    | undefined;

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{project.name}</CardTitle>
                <StatusIndicator
                  status={mapProjectStatusToServiceStatus(project.status)}
                  size="sm"
                />
                {framework && <Badge variant="outline">{framework}</Badge>}
              </div>
              <CardDescription className="text-base">
                {description || "No description"}
              </CardDescription>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {framework && <span>Framework: {framework}</span>}
                {repository !== "No repository configured" && (
                  <>
                    <span>•</span>
                    <span className="font-mono">{repository}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Created {createdAt}</span>
                {updatedAt !== "Never" && <span>• Updated {updatedAt}</span>}
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="deployments">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="containers">Containers</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Status</CardDescription>
                <CardTitle className="text-3xl capitalize">
                  {project.status.toLowerCase()}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Deployments</CardDescription>
                <CardTitle className="text-3xl">{deployments.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Framework</CardDescription>
                <CardTitle className="text-3xl">{framework || "Unknown"}</CardTitle>
              </CardHeader>
            </Card>
          </div>

          {repository !== "No repository configured" && (
            <Card>
              <CardHeader>
                <CardTitle>Repository</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-sm">{repository}</p>
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

        <TabsContent value="deployments">
          {deploymentsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <LoaderIcon className="h-5 w-5 animate-spin" />
                  <span>Loading deployments...</span>
                </div>
              </CardContent>
            </Card>
          ) : (
            <DeploymentSection project={project} deployments={deployments} />
          )}
        </TabsContent>

        <TabsContent value="containers" className="space-y-6">
          <ContainersPage projectId={projectId} />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Manage your project configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project ID</label>
                <p className="text-sm text-muted-foreground font-mono">{project.id}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <p className="text-sm text-muted-foreground">{project.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <p className="text-sm text-muted-foreground capitalize">
                  {project.status.toLowerCase()}
                </p>
              </div>
              {repository !== "No repository configured" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Repository</label>
                  <p className="text-sm text-muted-foreground font-mono">{repository}</p>
                </div>
              )}
              {framework && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Framework</label>
                  <p className="text-sm text-muted-foreground">{framework}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure environment variables, build settings, and more
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                onClick={() => void router.navigate({ to: `/projects/${project.id}/settings` })}
              >
                Open Full Settings Page
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
