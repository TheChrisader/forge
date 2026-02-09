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
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { Badge } from "@/shared/components/ui/badge";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import {
  ItemGroup,
  Item,
  ItemMedia,
  ItemContent,
  ItemTitle,
  ItemDescription,
  ItemActions,
} from "@/shared/components/ui/item";
import { Avatar, AvatarFallback, AvatarGroup } from "@/shared/components/ui/avatar";
import { ServerIcon, RocketIcon, PlusIcon } from "lucide-react";
import type { ServiceStatus } from "@forge/types";

const mockProject = {
  id: "forge-web",
  name: "forge-web",
  description: "Main web application for the Forge platform",
  status: "running" as ServiceStatus,
  framework: "React",
  repository: "github.com/forge/forge-web",
  team: ["JD", "SK", "MR"],
  createdAt: "Jan 15, 2024",
  lastDeployed: "2 hours ago",
};

const mockServices = [
  {
    id: "svc-1",
    name: "web-app",
    description: "Main web application",
    status: "running" as ServiceStatus,
    containers: 3,
  },
  {
    id: "svc-2",
    name: "admin-dashboard",
    description: "Admin interface",
    status: "running" as ServiceStatus,
    containers: 2,
  },
  {
    id: "svc-3",
    name: "public-site",
    description: "Public marketing site",
    status: "running" as ServiceStatus,
    containers: 2,
  },
  {
    id: "svc-4",
    name: "api-proxy",
    description: "API proxy service",
    status: "stopped" as ServiceStatus,
    containers: 0,
  },
];

const mockDeployments = [
  {
    id: "dep-1",
    version: "v2.1.0",
    status: "success" as ServiceStatus,
    timestamp: "2 hours ago",
    duration: "2m 34s",
  },
  {
    id: "dep-2",
    version: "v2.0.9",
    status: "success" as ServiceStatus,
    timestamp: "1 day ago",
    duration: "2m 15s",
  },
  {
    id: "dep-3",
    version: "v2.0.8",
    status: "failed" as ServiceStatus,
    timestamp: "2 days ago",
    duration: "1m 45s",
  },
];

export function ProjectDetailPage(): React.ReactElement {
  const { projectId } = useParams({ from: "/projects/$projectId" });

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/projects">Projects</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{projectId}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <CardTitle className="text-2xl">{mockProject.name}</CardTitle>
                <StatusIndicator status={mockProject.status} size="sm" />
              </div>
              <CardDescription className="text-base">{mockProject.description}</CardDescription>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Framework: {mockProject.framework}</span>
                <span>•</span>
                <span>Created {mockProject.createdAt}</span>
                <span>•</span>
                <span>Last deployed {mockProject.lastDeployed}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-3">
              <AvatarGroup>
                {mockProject.team.map((member, idx) => (
                  <Avatar key={idx} size="sm">
                    <AvatarFallback>{member}</AvatarFallback>
                  </Avatar>
                ))}
              </AvatarGroup>
              <Badge variant="outline">Production</Badge>
            </div>
          </div>
        </CardHeader>
      </Card>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="services">Services</TabsTrigger>
          <TabsTrigger value="deployments">Deployments</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <Card>
              <CardHeader>
                <CardDescription>Total Services</CardDescription>
                <CardTitle className="text-3xl">{mockServices.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Running</CardDescription>
                <CardTitle className="text-3xl">
                  {mockServices.filter((s) => s.status === "running").length}
                </CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader>
                <CardDescription>Total Deployments</CardDescription>
                <CardTitle className="text-3xl">47</CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Repository</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">{mockProject.repository}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Services</CardTitle>
                <Button variant="default" size="sm">
                  <PlusIcon />
                  Add Service
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ItemGroup>
                {mockServices.map((service) => (
                  <Item key={service.id}>
                    <ItemMedia variant="icon">
                      <ServerIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{service.name}</ItemTitle>
                      <ItemDescription>{service.description}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <StatusIndicator status={service.status} size="sm" />
                      <span className="text-sm text-muted-foreground">
                        {service.containers} {service.containers === 1 ? "container" : "containers"}
                      </span>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="deployments">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Deployments</CardTitle>
                <Button variant="outline" size="sm">
                  View All
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <ItemGroup>
                {mockDeployments.map((deployment) => (
                  <Item key={deployment.id}>
                    <ItemMedia variant="icon">
                      <RocketIcon />
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{deployment.version}</ItemTitle>
                      <ItemDescription>{deployment.timestamp}</ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      <StatusIndicator status={deployment.status} size="sm" />
                      <span className="text-sm text-muted-foreground">{deployment.duration}</span>
                    </ItemActions>
                  </Item>
                ))}
              </ItemGroup>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
              <CardDescription>Manage your project configuration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Project Name</label>
                <p className="text-sm text-muted-foreground">{mockProject.name}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Repository</label>
                <p className="text-sm text-muted-foreground">{mockProject.repository}</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Framework</label>
                <p className="text-sm text-muted-foreground">{mockProject.framework}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
