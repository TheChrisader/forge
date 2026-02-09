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
import { Avatar, AvatarFallback, AvatarGroup } from "@/shared/components/ui/avatar";
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
import type { ServiceStatus } from "@forge/types";

const mockProjects = [
  {
    id: "proj-1",
    name: "forge-web",
    description: "Main web application for the Forge platform",
    status: "running" as ServiceStatus,
    framework: "React",
    services: 4,
    team: ["JD", "SK", "MR"],
    lastDeployed: "2 hours ago",
  },
  {
    id: "proj-2",
    name: "forge-api",
    description: "RESTful API services and microservices",
    status: "running" as ServiceStatus,
    framework: "Node.js",
    services: 6,
    team: ["AL", "JD"],
    lastDeployed: "4 hours ago",
  },
  {
    id: "proj-3",
    name: "forge-worker",
    description: "Background job processing and cron tasks",
    status: "running" as ServiceStatus,
    framework: "Python",
    services: 3,
    team: ["SK"],
    lastDeployed: "1 day ago",
  },
  {
    id: "proj-4",
    name: "forge-mobile",
    description: "Mobile application backend services",
    status: "stopped" as ServiceStatus,
    framework: "React Native",
    services: 2,
    team: ["AL", "MR"],
    lastDeployed: "3 days ago",
  },
  {
    id: "proj-5",
    name: "forge-analytics",
    description: "Data analytics and reporting platform",
    status: "running" as ServiceStatus,
    framework: "Python",
    services: 5,
    team: ["JD", "AL", "SK", "MR"],
    lastDeployed: "5 hours ago",
  },
  {
    id: "proj-6",
    name: "forge-ml-pipeline",
    description: "Machine learning model training pipeline",
    status: "error" as ServiceStatus,
    framework: "Python",
    services: 2,
    team: ["MR"],
    lastDeployed: "1 week ago",
  },
];

const frameworkColors: Record<string, string> = {
  React: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  "Node.js": "bg-green-500/10 text-green-700 dark:text-green-400",
  Python: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400",
  "React Native": "bg-purple-500/10 text-purple-700 dark:text-purple-400",
};

export function ProjectsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardAction>
            <Button variant="default" size="sm">
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

      {mockProjects.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ItemGroup>
              {mockProjects.map((project) => (
                <Item key={project.id} className="cursor-pointer">
                  <ItemMedia variant="icon">
                    <FolderIcon />
                  </ItemMedia>
                  <ItemContent>
                    <ItemTitle>
                      {project.name}
                      <Badge variant="outline" className={frameworkColors[project.framework] || ""}>
                        {project.framework}
                      </Badge>
                    </ItemTitle>
                    <ItemDescription>{project.description}</ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <div className="flex flex-col items-end gap-2">
                      <StatusIndicator status={project.status} size="sm" />
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{project.services} services</span>
                        <AvatarGroup>
                          {project.team.slice(0, 3).map((member, idx) => (
                            <Avatar key={idx} size="sm">
                              <AvatarFallback>{member}</AvatarFallback>
                            </Avatar>
                          ))}
                          {project.team.length > 3 && (
                            <span className="text-xs">+{project.team.length - 3}</span>
                          )}
                        </AvatarGroup>
                        <span>Deployed {project.lastDeployed}</span>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon-sm" className="shrink-0">
                      <ChevronRightIcon />
                    </Button>
                  </ItemActions>
                </Item>
              ))}
            </ItemGroup>
          </CardContent>
        </Card>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>No projects found</EmptyTitle>
            <EmptyDescription>
              Get started by creating your first project or adjusting your search filters.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="default" size="sm">
              <PlusIcon />
              Create Project
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  );
}
