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
import { Badge } from "@/shared/components/ui/badge";
import {
  LoaderIcon,
  Settings2Icon,
  GitBranchIcon,
  HammerIcon,
  RocketIcon,
  CpuIcon,
  ContainerIcon,
  ActivityIcon,
  ZapIcon,
} from "lucide-react";
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
import { DeploySettings } from "../components/settings/DeploySettings";
import { cn } from "@/shared/lib/utils";

interface TabConfig {
  value: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}

const tabsConfig: TabConfig[] = [
  { value: "general", label: "General", icon: Settings2Icon, accent: "bg-red-500" },
  { value: "source", label: "Source", icon: GitBranchIcon, accent: "bg-amber-500" },
  { value: "build", label: "Build", icon: HammerIcon, accent: "bg-blue-500" },
  { value: "deploy", label: "Deploy", icon: RocketIcon, accent: "bg-green-500" },
  { value: "runtime", label: "Runtime", icon: CpuIcon, accent: "bg-emerald-500" },
  { value: "container", label: "Container", icon: ContainerIcon, accent: "bg-purple-500" },
  { value: "resources", label: "Resources", icon: ZapIcon, accent: "bg-cyan-500" },
  { value: "health", label: "Health", icon: ActivityIcon, accent: "bg-rose-500" },
];

export function ProjectSettingsPage(): React.ReactElement | null {
  const { projectId } = useParams({
    from: "/authenticated/projects/$projectId/settings",
  });

  const { data: project, isLoading, error } = useProject(projectId);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <LoaderIcon className="h-5 w-5 animate-spin" />
          <span className="font-mono text-sm">Loading project settings...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-destructive font-mono text-sm">
          {error ? "Failed to load project" : "Project not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border/40 bg-card/20 backdrop-blur-sm">
        <div className="mx-auto max-w-6xl px-6 py-6">
          <Breadcrumb className="mb-4">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    to="/projects"
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    Projects
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink asChild>
                  <Link
                    to={`/projects/$projectId`}
                    params={{ projectId }}
                    className="text-muted-foreground hover:text-foreground transition-colors text-sm"
                  >
                    <span className="font-mono">{project.name}</span>
                  </Link>
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage className="text-sm">Settings</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-border/60 bg-muted/30">
              <Settings2Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold font-serif tracking-tight">Project Settings</h1>
              <p className="text-xs text-muted-foreground font-mono mt-0.5 opacity-70">
                /{project.name}/settings
              </p>
            </div>
            <Badge variant="outline" className="font-mono text-xs border-border/40">
              ID: {project.id.slice(0, 8)}
            </Badge>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-border/40 bg-card/10">
        <div className="mx-auto max-w-6xl px-6 pt-6">
          <Tabs defaultValue="general">
            <TabsList
              variant="line"
              className="w-full justify-start px-0 bg-transparent rounded-none border-0"
            >
              {tabsConfig.map((tab) => {
                const Icon = tab.icon;
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="gap-2 h-10 px-4 data-[state=active]:text-foreground data-[state=active]:bg-transparent rounded-none transition-all"
                  >
                    <Icon className="h-4 w-4" />
                    <span className="font-medium">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {/* General Tab */}
            <TabsContent value="general" className="mt-8 pb-12">
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tabsConfig[0].accent,
                        "shadow-[0_0_8px_currentColor]"
                      )}
                    />
                    <h2 className="text-lg font-semibold font-serif tracking-tight">
                      General Settings
                    </h2>
                  </div>
                  <Separator className="bg-border/40" />
                  <GeneralSettings project={project} />
                </section>

                <Separator className="bg-border/40" />

                <section className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-destructive/30" />
                    <span className="text-xs font-mono uppercase tracking-wider text-destructive/80 px-2 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
                      Danger Zone
                    </span>
                    <div className="h-px flex-1 bg-destructive/30" />
                  </div>
                  <DangerZone project={project} />
                </section>
              </div>
            </TabsContent>

            {/* Source Tab */}
            <TabsContent value="source" className="mt-8 pb-12">
              <section className="space-y-4">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      tabsConfig[1].accent,
                      "shadow-[0_0_8px_currentColor]"
                    )}
                  />
                  <h2 className="text-lg font-semibold font-serif tracking-tight">
                    Source Configuration
                  </h2>
                </div>
                <Separator className="bg-border/40" />
                <SourceSettings project={project} />
              </section>
            </TabsContent>

            {/* Build Tab */}
            <TabsContent value="build" className="mt-8 pb-12">
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          tabsConfig[2].accent,
                          "shadow-[0_0_8px_currentColor]"
                        )}
                      />
                      <h2 className="text-lg font-semibold font-serif tracking-tight">
                        Build Configuration
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/50">[BUILD]</span>
                  </div>
                  <Separator className="bg-border/40" />
                  <BuildSettings project={project} />
                </section>

                <Separator className="bg-border/40" />

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          tabsConfig[2].accent,
                          "shadow-[0_0_8px_currentColor] opacity-60"
                        )}
                      />
                      <h2 className="text-lg font-semibold font-serif tracking-tight">
                        Build Cache
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/50">[CACHE]</span>
                  </div>
                  <Separator className="bg-border/40" />
                  <CacheSettings project={project} />
                </section>
              </div>
            </TabsContent>

            {/* Deploy Tab */}
            <TabsContent value="deploy" className="mt-8 pb-12">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tabsConfig[3].accent,
                        "shadow-[0_0_8px_currentColor]"
                      )}
                    />
                    <h2 className="text-lg font-semibold font-serif tracking-tight">
                      Deployment Strategy
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/50">[DEPLOY]</span>
                </div>
                <Separator className="bg-border/40" />
                <DeploySettings project={project} />
              </section>
            </TabsContent>

            {/* Runtime Tab */}
            <TabsContent value="runtime" className="mt-8 pb-12">
              <div className="space-y-8">
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          tabsConfig[4].accent,
                          "shadow-[0_0_8px_currentColor]"
                        )}
                      />
                      <h2 className="text-lg font-semibold font-serif tracking-tight">
                        Runtime Configuration
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/50">[RUNTIME]</span>
                  </div>
                  <Separator className="bg-border/40" />
                  <RuntimeSettings project={project} />
                </section>

                <Separator className="bg-border/40" />

                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          tabsConfig[4].accent,
                          "shadow-[0_0_8px_currentColor] opacity-60"
                        )}
                      />
                      <h2 className="text-lg font-semibold font-serif tracking-tight">
                        Environment Variables
                      </h2>
                    </div>
                    <span className="text-xs font-mono text-muted-foreground/50">[ENV]</span>
                  </div>
                  <Separator className="bg-border/40" />
                  <EnvVarsSettings project={project} />
                </section>
              </div>
            </TabsContent>

            {/* Container Tab */}
            <TabsContent value="container" className="mt-8 pb-12">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tabsConfig[5].accent,
                        "shadow-[0_0_8px_currentColor]"
                      )}
                    />
                    <h2 className="text-lg font-semibold font-serif tracking-tight">
                      Container Settings
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/50">[CONTAINER]</span>
                </div>
                <Separator className="bg-border/40" />
                <ContainerSettings project={project} />
              </section>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources" className="mt-8 pb-12">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tabsConfig[6].accent,
                        "shadow-[0_0_8px_currentColor]"
                      )}
                    />
                    <h2 className="text-lg font-semibold font-serif tracking-tight">
                      Resources & Storage
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/50">[RESOURCES]</span>
                </div>
                <Separator className="bg-border/40" />
                <ResourcesSettings project={project} />
              </section>
            </TabsContent>

            {/* Health Tab */}
            <TabsContent value="health" className="mt-8 pb-12">
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        tabsConfig[7].accent,
                        "shadow-[0_0_8px_currentColor]"
                      )}
                    />
                    <h2 className="text-lg font-semibold font-serif tracking-tight">
                      Health & Lifecycle
                    </h2>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground/50">[HEALTH]</span>
                </div>
                <Separator className="bg-border/40" />
                <HealthSettings project={project} />
              </section>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
