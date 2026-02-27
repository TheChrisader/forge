import { useParams, Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Separator } from "@/shared/components/ui/separator";
import { LoaderIcon } from "lucide-react";
import { useProject } from "@/core/api/hooks/useProjects";
import { GeneralSettings } from "../components/settings/GeneralSettings";
import { DangerZone } from "../components/settings/DangerZone";
import { SourceSettings } from "../components/settings/SourceSettings";
import { BuildSettings } from "../components/settings/BuildSettings";
import { CacheSettings } from "../components/settings/CacheSettings";
import { RuntimeSettings } from "../components/settings/RuntimeSettings";
import { EnvVarsSettings } from "../components/settings/EnvVarsSettings";
import { ContainerSettings } from "../components/settings/ContainerSettings";
import { ResourcesSettings } from "../components/settings/ResourcesSettings";
import { HealthSettings } from "../components/settings/HealthSettings";

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
    <div className="max-w-6xl px-2 mx-auto py-8 space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/projects/$projectId`} params={{ projectId }}>
                {project.name}
              </Link>
            </BreadcrumbLink>
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

      {/* Settings Tabs */}
      <Tabs defaultValue="general">
        <TabsList variant="line" className="w-full justify-start">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="source">Source</TabsTrigger>
          <TabsTrigger value="build">Build</TabsTrigger>
          <TabsTrigger value="runtime">Runtime</TabsTrigger>
          <TabsTrigger value="container">Container</TabsTrigger>
          <TabsTrigger value="resources">Resources</TabsTrigger>
          <TabsTrigger value="health">Health & Lifecycle</TabsTrigger>
        </TabsList>

        {/* General Tab */}
        <TabsContent value="general" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">General Settings</h2>
            <p className="text-sm text-muted-foreground">Basic project information</p>
          </div>
          <Separator />
          <GeneralSettings project={project} />

          <Separator />

          <div>
            <h2 className="text-xl font-semibold text-destructive">Danger Zone</h2>
            <p className="text-sm text-muted-foreground">
              Irreversible actions that affect your project
            </p>
          </div>
          <DangerZone project={project} />
        </TabsContent>

        {/* Source Tab */}
        <TabsContent value="source" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Source Configuration</h2>
            <p className="text-sm text-muted-foreground">Where your project code is stored</p>
          </div>
          <Separator />
          <SourceSettings project={project} />
        </TabsContent>

        {/* Build Tab */}
        <TabsContent value="build" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Build Configuration</h2>
            <p className="text-sm text-muted-foreground">How your project is built</p>
          </div>
          <Separator />
          <BuildSettings project={project} />

          <Separator />

          <div>
            <h2 className="text-xl font-semibold">Build Cache</h2>
            <p className="text-sm text-muted-foreground">
              Manage cached build artifacts to speed up deployments
            </p>
          </div>
          <Separator />
          <CacheSettings project={project} />
        </TabsContent>

        {/* Runtime Tab */}
        <TabsContent value="runtime" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Runtime Configuration</h2>
            <p className="text-sm text-muted-foreground">How your application runs</p>
          </div>
          <Separator />
          <RuntimeSettings project={project} />

          <Separator />

          <div>
            <h2 className="text-xl font-semibold">Environment Variables</h2>
            <p className="text-sm text-muted-foreground">
              Configure environment variables for your application
            </p>
          </div>
          <Separator />
          <EnvVarsSettings project={project} />
        </TabsContent>

        {/* Container Tab */}
        <TabsContent value="container" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Container Settings</h2>
            <p className="text-sm text-muted-foreground">
              Container security and configuration options
            </p>
          </div>
          <Separator />
          <ContainerSettings project={project} />
        </TabsContent>

        {/* Resources Tab */}
        <TabsContent value="resources" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Resources & Storage</h2>
            <p className="text-sm text-muted-foreground">CPU, memory limits, and volume mounts</p>
          </div>
          <Separator />
          <ResourcesSettings project={project} />
        </TabsContent>

        {/* Health Tab */}
        <TabsContent value="health" className="mt-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold">Health & Lifecycle</h2>
            <p className="text-sm text-muted-foreground">
              Health checks and container lifecycle policies
            </p>
          </div>
          <Separator />
          <HealthSettings project={project} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
