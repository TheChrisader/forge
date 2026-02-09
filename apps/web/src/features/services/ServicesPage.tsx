import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ButtonGroup } from "@/shared/components/ui/button-group";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableCell,
  TableHead,
} from "@/shared/components/ui/table";
import { StatusIndicator } from "@/shared/components/ui/status-indicator";
import { Badge } from "@/shared/components/ui/badge";
import { Avatar, AvatarFallback, AvatarGroup } from "@/shared/components/ui/avatar";
import { Input } from "@/shared/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/shared/components/ui/pagination";
import { PlusIcon, SearchIcon, EllipsisIcon } from "lucide-react";
import type { ServiceStatus } from "@forge/types";

const mockServices = [
  {
    id: "svc-1",
    name: "web-app",
    project: "forge-web",
    status: "running" as ServiceStatus,
    type: "web",
    containers: 3,
    team: ["JD", "SK", "MR"],
  },
  {
    id: "svc-2",
    name: "api-gateway",
    project: "forge-api",
    status: "running" as ServiceStatus,
    type: "worker",
    containers: 2,
    team: ["AL", "JD"],
  },
  {
    id: "svc-3",
    name: "background-jobs",
    project: "forge-worker",
    status: "stopped" as ServiceStatus,
    type: "cron",
    containers: 1,
    team: ["SK"],
  },
  {
    id: "svc-4",
    name: "auth-service",
    project: "forge-api",
    status: "running" as ServiceStatus,
    type: "web",
    containers: 4,
    team: ["AL", "MR", "JD", "SK"],
  },
  {
    id: "svc-5",
    name: "email-processor",
    project: "forge-worker",
    status: "error" as ServiceStatus,
    type: "worker",
    containers: 2,
    team: ["MR"],
  },
  {
    id: "svc-6",
    name: "admin-dashboard",
    project: "forge-web",
    status: "running" as ServiceStatus,
    type: "web",
    containers: 3,
    team: ["JD", "AL"],
  },
  {
    id: "svc-7",
    name: "payment-service",
    project: "forge-api",
    status: "creating" as ServiceStatus,
    type: "web",
    containers: 0,
    team: ["SK", "MR"],
  },
  {
    id: "svc-8",
    name: "analytics-worker",
    project: "forge-worker",
    status: "running" as ServiceStatus,
    type: "cron",
    containers: 1,
    team: ["AL"],
  },
];

const serviceTypeLabels: Record<string, string> = {
  web: "Web",
  worker: "Worker",
  cron: "Cron",
};

export function ServicesPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Services</CardTitle>
          <CardAction>
            <Button variant="default" size="sm">
              <PlusIcon />
              Create Service
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ButtonGroup>
              <Button variant="default" size="sm">
                All
              </Button>
              <Button variant="outline" size="sm">
                Running
              </Button>
              <Button variant="outline" size="sm">
                Stopped
              </Button>
              <Button variant="outline" size="sm">
                Errors
              </Button>
            </ButtonGroup>

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search services..." className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Containers</TableHead>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockServices.map((service) => (
                <TableRow key={service.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{service.name}</span>
                      <span className="text-xs text-muted-foreground">{service.project}</span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <StatusIndicator status={service.status} size="sm" />
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary">
                      {serviceTypeLabels[service.type] || service.type}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <span className="text-muted-foreground">
                      {service.containers} {service.containers === 1 ? "container" : "containers"}
                    </span>
                  </TableCell>

                  <TableCell>
                    <AvatarGroup>
                      {service.team.slice(0, 3).map((member, idx) => (
                        <Avatar key={idx} size="sm">
                          <AvatarFallback>{member}</AvatarFallback>
                        </Avatar>
                      ))}
                      {service.team.length > 3 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          +{service.team.length - 3}
                        </span>
                      )}
                    </AvatarGroup>
                  </TableCell>

                  <TableCell className="text-right">
                    <ButtonGroup>
                      <Button variant="ghost" size="icon-xs">
                        <EllipsisIcon />
                      </Button>
                    </ButtonGroup>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#" />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
