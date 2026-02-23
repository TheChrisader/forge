import { useState } from "react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ButtonGroup } from "@/shared/components/ui/button-group";
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
import { Empty } from "@/shared/components/ui/empty";
import {
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/shared/components/ui/empty";
import {
  PlusIcon,
  SearchIcon,
  ListIcon,
  GridIcon,
  FolderIcon,
  ChevronRightIcon,
} from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { useProjects } from "@/core/api/hooks/useProjects";
import { mapProjectStatusToServiceStatus } from "@/shared/lib/utils";
import { CreateProjectDialog } from "./components/CreateProjectDialog";

const frameworkColors: Record<string, string> = {
  React: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Node.js": "bg-green-500/10 text-green-700 dark:text-green-400",
  Python: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  "React Native": "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  Go: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-400",
  Rust: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  Java: "bg-red-500/10 text-red-700 dark:text-red-400",
  ".NET": "bg-indigo-500/10 text-indigo-700 dark:text-indigo-400",
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

export function ProjectsPage(): React.ReactElement {
  const router = useRouter();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const { data: projects = [], isLoading, error } = useProjects();

  const handleProjectClick = (projectId: string): void => {
    void router.navigate({ to: `/projects/${projectId}` });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardAction>
            <Button variant="default" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon />
              New Project
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search projects..." className="pl-9" />
            </div>

            <ButtonGroup>
              <Button variant="default" size="icon-sm">
                <ListIcon />
              </Button>
              <Button variant="outline" size="icon-sm">
                <GridIcon />
              </Button>
            </ButtonGroup>
          </div>
        </CardContent>
      </Card>

      {isLoading && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-muted-foreground">Loading projects...</div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-destructive">Failed to load projects. Please try again.</div>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && projects.length === 0 && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No projects yet</EmptyTitle>
            <EmptyDescription>Create your first project to get started</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="default" size="sm" onClick={() => setIsCreateDialogOpen(true)}>
              <PlusIcon />
              Create Project
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {!isLoading && !error && projects.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <ItemGroup>
              {projects.map((project) => {
                const config = project.config as Record<string, unknown> | undefined;
                const framework = config?.framework as string | undefined;
                const metadata = project.metadata as Record<string, unknown> | undefined;
                const description = metadata?.description as string | undefined;

                return (
                  <Item
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => handleProjectClick(project.id)}
                  >
                    <ItemMedia variant="icon">
                      <FolderIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>
                        {project.name}
                        {framework && (
                          <Badge variant="outline" className={frameworkColors[framework] || ""}>
                            {framework}
                          </Badge>
                        )}
                      </ItemTitle>
                      <ItemDescription>{description || "No description"}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <div className="flex flex-col items-end gap-2">
                        <StatusIndicator
                          status={mapProjectStatusToServiceStatus(project.status)}
                          size="sm"
                        />
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          {project.updatedAt && (
                            <span>Updated {formatTimestamp(project.updatedAt)}</span>
                          )}
                        </div>
                      </div>
                      <Button variant="ghost" size="icon-sm" className="shrink-0">
                        <ChevronRightIcon />
                      </Button>
                    </ItemActions>
                  </Item>
                );
              })}
            </ItemGroup>
          </CardContent>
        </Card>
      )}

      <CreateProjectDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
      />
    </div>
  );
}
