import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/shared/components/ui/card";
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
import {
  PlusIcon,
  SearchIcon,
  EllipsisIcon,
  DatabaseIcon,
  HardDriveIcon,
  ListIcon,
  Search as SearchIcon2,
  BarChart3Icon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";
import type { ServiceStatus } from "@forge/types";

const mockServices = [
  {
    id: "svc-1",
    name: "postgres-primary",
    project: "forge-api",
    status: "RUNNING" as ServiceStatus,
    type: "DATABASE",
    containers: 3,
    team: ["JD", "SK"],
  },
  {
    id: "svc-2",
    name: "redis-cache",
    project: "forge-web",
    status: "HEALTHY" as ServiceStatus,
    type: "CACHE",
    containers: 2,
    team: ["AL", "JD"],
  },
  {
    id: "svc-3",
    name: "sidekiq-queue",
    project: "forge-worker",
    status: "STOPPED" as ServiceStatus,
    type: "QUEUE",
    containers: 1,
    team: ["SK"],
  },
  {
    id: "svc-4",
    name: "s3-backup",
    project: "forge-api",
    status: "RUNNING" as ServiceStatus,
    type: "STORAGE",
    containers: 1,
    team: ["AL", "MR"],
  },
  {
    id: "svc-5",
    name: "elasticsearch-cluster",
    project: "forge-web",
    status: "ERROR" as ServiceStatus,
    type: "SEARCH",
    containers: 4,
    team: ["MR", "JD", "SK"],
  },
  {
    id: "svc-6",
    name: "prometheus-monitor",
    project: "infra",
    status: "HEALTHY" as ServiceStatus,
    type: "MONITORING",
    containers: 2,
    team: ["JD", "AL"],
  },
  {
    id: "svc-7",
    name: "custom-auth-provider",
    project: "forge-api",
    status: "CREATING" as ServiceStatus,
    type: "CUSTOM",
    containers: 1,
    team: ["SK", "MR"],
  },
  {
    id: "svc-8",
    name: "mongodb-analytics",
    project: "forge-worker",
    status: "RUNNING" as ServiceStatus,
    type: "DATABASE",
    containers: 2,
    team: ["AL"],
  },
];

const serviceTypeConfig: Record<string, { label: string; icon: LucideIcon }> = {
  DATABASE: { label: "Database", icon: DatabaseIcon },
  CACHE: { label: "Cache", icon: HardDriveIcon },
  QUEUE: { label: "Queue", icon: ListIcon },
  STORAGE: { label: "Storage", icon: HardDriveIcon },
  SEARCH: { label: "Search", icon: SearchIcon2 },
  MONITORING: { label: "Monitoring", icon: BarChart3Icon },
  CUSTOM: { label: "Custom", icon: SettingsIcon },
};

export function ServicesPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="font-serif">Services</CardTitle>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Manage your deployed services
              </CardDescription>
            </div>
            <CardAction>
              <Button variant="default" size="sm" className="group">
                <PlusIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                Create Service
              </Button>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ButtonGroup>
              <Button
                variant="default"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-wider"
              >
                All
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-wider"
              >
                Running
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-wider"
              >
                Stopped
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="font-mono text-[10px] uppercase tracking-wider"
              >
                Errors
              </Button>
            </ButtonGroup>

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search services..." className="pl-9 font-sans text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Services Table Card */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border/50 hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Name
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Status
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Type
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Containers
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Team
                </TableHead>
                <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockServices.map((service) => {
                const typeConfig = serviceTypeConfig[service.type] || {
                  label: service.type,
                  icon: SettingsIcon,
                };
                const TypeIcon = typeConfig.icon;

                return (
                  <TableRow key={service.id} className="group hover:bg-muted/30 transition-colors">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted transition-colors group-hover:scale-110">
                          <TypeIcon className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-sans text-sm font-medium">{service.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground uppercase">
                            {service.project}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <StatusIndicator status={service.status} size="sm" />
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant="secondary"
                        className="font-mono text-[10px] uppercase tracking-wider"
                      >
                        {typeConfig.label}
                      </Badge>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {service.containers} {service.containers === 1 ? "container" : "containers"}
                      </span>
                    </TableCell>

                    <TableCell>
                      <AvatarGroup>
                        {service.team.slice(0, 3).map((member, idx) => (
                          <Avatar
                            key={idx}
                            size="sm"
                            className="group-hover:scale-110 transition-transform"
                          >
                            <AvatarFallback className="font-mono text-[10px]">
                              {member}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {service.team.length > 3 && (
                          <span className="ml-2 font-mono text-[10px] text-muted-foreground">
                            +{service.team.length - 3}
                          </span>
                        )}
                      </AvatarGroup>
                    </TableCell>

                    <TableCell className="text-right">
                      <ButtonGroup>
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          className="group-hover:scale-110 transition-transform"
                        >
                          <EllipsisIcon className="h-4 w-4" />
                        </Button>
                      </ButtonGroup>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              className="font-mono text-[10px] uppercase tracking-wider"
            />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              isActive
              className="font-mono text-[10px] uppercase tracking-wider"
            >
              1
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" className="font-mono text-[10px] uppercase tracking-wider">
              2
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" className="font-mono text-[10px] uppercase tracking-wider">
              3
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" className="font-mono text-[10px] uppercase tracking-wider" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
