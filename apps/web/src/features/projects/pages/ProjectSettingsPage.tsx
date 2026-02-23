import { useParams } from "@tanstack/react-router";
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
import { LoaderIcon } from "lucide-react";
import { useProject } from "@/core/api/hooks/useProjects";
import { GeneralSettings } from "../components/settings/GeneralSettings";
import { GitSettings } from "../components/settings/GitSettings";
import { BuildSettings } from "../components/settings/BuildSettings";
import { EnvVarsSettings } from "../components/settings/EnvVarsSettings";
import { DangerZone } from "../components/settings/DangerZone";

export function ProjectSettingsPage(): React.ReactElement | null {
  const { projectId } = useParams({
    from: "/authenticated/projects/$projectId/settings",
  });

  const { data: project, isLoading, error } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span>Loading project settings...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive">
          {error ? "Failed to load project" : "Project not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 space-y-8">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink href={`/projects/${projectId}`}>{project.name}</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Settings</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div>
        <h1 className="text-3xl font-bold">Project Settings</h1>
        <p className="text-muted-foreground">Manage your project configuration</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>General Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <GeneralSettings project={project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Git Repository</CardTitle>
        </CardHeader>
        <CardContent>
          <GitSettings project={project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Build Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <BuildSettings project={project} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Environment Variables</CardTitle>
        </CardHeader>
        <CardContent>
          <EnvVarsSettings project={project} />
        </CardContent>
      </Card>

      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions that affect your project</CardDescription>
        </CardHeader>
        <CardContent>
          <DangerZone project={project} />
        </CardContent>
      </Card>
    </div>
  );
}
