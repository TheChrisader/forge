import { useState, useMemo } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardContent,
  CardDescription,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/shared/components/ui/item";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import { Badge } from "@/shared/components/ui/badge";
import {
  PlusIcon,
  SearchIcon,
  FolderIcon,
  ChevronRightIcon,
  ActivityIcon,
  Code2Icon,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useProjects } from "@/core/api/hooks/useProjects";
import { mapProjectStatusToServiceStatus } from "@/shared/lib/utils";
import { CreateProjectDialog } from "./components/CreateProjectDialog";
import type { Project } from "@forge/types";

const frameworkColors: Record<string, string> = {
  React: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20",
  "Node.js": "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20",
  Python: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 border-yellow-500/20",
  "React Native": "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20",
  Go: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20",
  Rust: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20",
  Java: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20",
  ".NET": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/20",
};

const frameworkIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  React: Code2Icon,
  "Node.js": Code2Icon,
  Python: Code2Icon,
  "React Native": Code2Icon,
  Go: Code2Icon,
  Rust: Code2Icon,
  Java: Code2Icon,
  ".NET": Code2Icon,
};

function formatTimestamp(timestamp: Date | string | null | undefined): string {
  if (!timestamp) return "Never";

  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Filter projects by search query
function filterProjects(projects: Project[], query: string): Project[] {
  if (!query.trim()) return projects;
  const lowerQuery = query.toLowerCase();
  return projects.filter((project) => {
    const config = project.config as Record<string, unknown> | undefined;
    const framework = config?.framework as string | undefined;
    const metadata = project.metadata as Record<string, unknown> | undefined;
    const description = metadata?.description as string | undefined;

    return (
      project.name.toLowerCase().includes(lowerQuery) ||
      framework?.toLowerCase().includes(lowerQuery) ||
      description?.toLowerCase().includes(lowerQuery)
    );
  });
}

export function ProjectsPage(): React.ReactElement {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: projects = [], isLoading, error } = useProjects();

  // Filter projects based on search
  const filteredProjects = useMemo(
    () => filterProjects(projects, searchQuery),
    [projects, searchQuery]
  );

  const handleProjectClick = (projectId: string): void => {
    void router.navigate({ to: `/projects/${projectId}` });
  };

  return (
    <div className="space-y-6">
      {/* Search Bar Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="font-serif">Projects</CardTitle>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Manage your projects
              </CardDescription>
            </div>
            <CardAction>
              <Button variant="default" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
                <PlusIcon className="h-3.5 w-3.5" />
                <span className="font-sans text-sm">New Project</span>
              </Button>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search projects by name, framework, or description..."
                className="font-sans pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {searchQuery.trim() && (
              <Button
                variant="ghost"
                size="sm"
                className="font-mono text-[10px] uppercase"
                onClick={() => setSearchQuery("")}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-16">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                <p className="mt-4 font-sans text-sm text-muted-foreground">Loading projects...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <Card className="border-destructive/30">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-destructive/10 mb-4">
                <ActivityIcon className="h-7 w-7 text-destructive" />
              </div>
              <p className="font-serif text-lg font-semibold text-destructive">
                Failed to load projects
              </p>
              <p className="mt-2 font-sans text-sm text-muted-foreground">
                {error.message || "An unknown error occurred"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && filteredProjects.length === 0 && (
        <div className="border border-dashed rounded-lg py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 mx-auto mb-4">
            <FolderIcon className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-serif text-base font-semibold">
            {searchQuery.trim() ? "No projects found" : "No projects yet"}
          </h3>
          <p className="mt-2 font-sans text-sm text-muted-foreground">
            {searchQuery.trim()
              ? `No projects match "${searchQuery}". Try a different search term.`
              : "Create your first project to get started"}
          </p>
          {!searchQuery.trim() && (
            <Button
              variant="default"
              size="sm"
              className="mt-4 font-sans text-sm"
              onClick={() => setIsCreateDialogOpen(true)}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              <span>Create Project</span>
            </Button>
          )}
        </div>
      )}

      {/* Projects List */}
      {!isLoading && !error && filteredProjects.length > 0 && (
        <div className="space-y-4">
          {/* List header */}
          <div className="flex items-center justify-between text-sm">
            <h3 className="font-serif font-semibold">All Projects</h3>
            <span className="font-mono text-[10px] uppercase text-muted-foreground">
              {filteredProjects.length} total
            </span>
          </div>

          <Card>
            <CardContent className="p-0">
              <ItemGroup>
                {filteredProjects.map((project) => {
                  const config = project.config as Record<string, unknown> | undefined;
                  const framework = config?.framework as string | undefined;
                  const metadata = project.metadata as Record<string, unknown> | undefined;
                  const description = metadata?.description as string | undefined;
                  const FrameworkIcon = framework ? frameworkIcons[framework] : FolderIcon;
                  const isActive = project.status === "ACTIVE";

                  return (
                    <Item
                      key={project.id}
                      className="cursor-pointer group px-4 py-3 hover:border-border/50 transition-all duration-200"
                      onClick={() => handleProjectClick(project.id)}
                    >
                      <ItemMedia variant="icon">
                        <div className="relative">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                              isActive
                                ? "bg-primary/10 group-hover:bg-primary/20 group-hover:scale-110"
                                : "bg-muted/50 group-hover:bg-muted group-hover:scale-110"
                            } transition-all duration-200`}
                          >
                            <FrameworkIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          {isActive && (
                            <div className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full bg-success-500 ring-2 ring-background" />
                          )}
                        </div>
                      </ItemMedia>
                      <ItemContent>
                        <ItemTitle>
                          <span className="font-sans group-hover:text-primary transition-colors">
                            {project.name}
                          </span>
                          {framework && (
                            <Badge
                              variant="outline"
                              className={`ml-2 font-mono text-[9px] uppercase ${frameworkColors[framework] || ""} shrink-0`}
                            >
                              {framework}
                            </Badge>
                          )}
                        </ItemTitle>
                        <ItemDescription className="line-clamp-1 font-sans">
                          {description || "No description provided"}
                        </ItemDescription>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span className="font-mono text-[10px] uppercase">
                            {project.id.slice(0, 8)}
                          </span>
                          {project.updatedAt && (
                            <>
                              <span>•</span>
                              <span className="font-sans text-xs">
                                Updated {formatTimestamp(project.updatedAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </ItemContent>
                      <ItemActions>
                        <div className="flex flex-col items-end gap-2">
                          <StatusIndicator
                            status={mapProjectStatusToServiceStatus(project.status)}
                            size="sm"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="shrink-0 group-hover:bg-primary/10 group-hover:text-primary group-hover:scale-110 transition-all duration-200"
                        >
                          <ChevronRightIcon className="h-4 w-4" />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </CardContent>
          </Card>
        </div>
      )}

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </div>
  );
}
