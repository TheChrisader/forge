import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { ButtonGroup } from "@/shared/components/ui/button-group";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
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
import { Avatar, AvatarFallback } from "@/shared/components/ui/avatar";
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
import type { DeploymentStatus } from "@forge/types";

const mockDeployments = [
  {
    id: "dep-1",
    project: "forge-web",
    service: "web-app",
    environment: "production",
    commit: "a1b2c3d",
    branch: "main",
    deployer: "JD",
    status: "success" as DeploymentStatus,
    duration: "2m 34s",
    timestamp: "2 hours ago",
  },
  {
    id: "dep-2",
    project: "forge-api",
    service: "api-gateway",
    environment: "staging",
    commit: "e4f5g6h",
    branch: "feature/auth",
    deployer: "SK",
    status: "deploying" as DeploymentStatus,
    duration: "1m 12s",
    timestamp: "15 minutes ago",
  },
  {
    id: "dep-3",
    project: "forge-worker",
    service: "background-jobs",
    environment: "production",
    commit: "i7j8k9l",
    branch: "main",
    deployer: "MR",
    status: "failed" as DeploymentStatus,
    duration: "45s",
    timestamp: "4 hours ago",
  },
  {
    id: "dep-4",
    project: "forge-web",
    service: "admin-dashboard",
    environment: "production",
    commit: "m0n1o2p",
    branch: "main",
    deployer: "JD",
    status: "success" as DeploymentStatus,
    duration: "1m 56s",
    timestamp: "6 hours ago",
  },
  {
    id: "dep-5",
    project: "forge-api",
    service: "auth-service",
    environment: "development",
    commit: "q3r4s5t",
    branch: "feature/oauth",
    deployer: "AL",
    status: "building" as DeploymentStatus,
    duration: "3m 20s",
    timestamp: "30 minutes ago",
  },
  {
    id: "dep-6",
    project: "forge-worker",
    service: "email-processor",
    environment: "staging",
    commit: "u6v7w8x",
    branch: "main",
    deployer: "SK",
    status: "success" as DeploymentStatus,
    duration: "58s",
    timestamp: "1 day ago",
  },
  {
    id: "dep-7",
    project: "forge-web",
    service: "public-site",
    environment: "production",
    commit: "y9z0a1b",
    branch: "release/v2.1",
    deployer: "MR",
    status: "success" as DeploymentStatus,
    duration: "2m 15s",
    timestamp: "1 day ago",
  },
  {
    id: "dep-8",
    project: "forge-api",
    service: "payment-service",
    environment: "staging",
    commit: "c2d3e4f",
    branch: "feature/payments",
    deployer: "JD",
    status: "pending" as DeploymentStatus,
    duration: "-",
    timestamp: "Just now",
  },
  {
    id: "dep-9",
    project: "forge-worker",
    service: "analytics-worker",
    environment: "production",
    commit: "g5h6i7j",
    branch: "main",
    deployer: "AL",
    status: "success" as DeploymentStatus,
    duration: "1m 42s",
    timestamp: "2 days ago",
  },
  {
    id: "dep-10",
    project: "forge-web",
    service: "mobile-api",
    environment: "production",
    commit: "k8l9m0n",
    branch: "hotfix/crash",
    deployer: "SK",
    status: "rolled-back" as DeploymentStatus,
    duration: "1m 30s",
    timestamp: "3 days ago",
  },
];

export function DeploymentsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Deployments</CardTitle>
          <CardAction>
            <Button variant="default" size="sm">
              <PlusIcon />
              New Deployment
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select defaultValue="all">
              <SelectTrigger size="sm" className="w-35">
                <SelectValue placeholder="Environment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Environments</SelectItem>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>

            <Select defaultValue="all">
              <SelectTrigger size="sm" className="w-35">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="deploying">Deploying</SelectItem>
                <SelectItem value="building">Building</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search deployments..." className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Commit</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Deployer</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockDeployments.map((deployment) => (
                <TableRow key={deployment.id}>
                  <TableCell>
                    <StatusIndicator status={deployment.status} size="sm" />
                  </TableCell>

                  <TableCell className="font-medium">{deployment.project}</TableCell>

                  <TableCell>{deployment.service}</TableCell>

                  <TableCell>
                    <Badge variant="outline">{deployment.environment}</Badge>
                  </TableCell>

                  <TableCell>
                    <Badge variant="secondary" className="font-mono">
                      {deployment.commit}
                    </Badge>
                  </TableCell>

                  <TableCell>{deployment.branch}</TableCell>

                  <TableCell>
                    <Avatar size="sm">
                      <AvatarFallback>{deployment.deployer}</AvatarFallback>
                    </Avatar>
                  </TableCell>

                  <TableCell className="text-muted-foreground">{deployment.duration}</TableCell>

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
            <PaginationLink href="#">10</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#" />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
