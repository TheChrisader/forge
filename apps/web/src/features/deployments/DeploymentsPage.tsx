import { useState, useMemo, useEffect } from "react";
import { useRouter, useParams } from "@tanstack/react-router";
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
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis,
} from "@/shared/components/ui/pagination";
import { SearchIcon, EllipsisIcon, ExternalLinkIcon } from "lucide-react";
import { useProjectDeploymentsWithFilters } from "@/core/api/hooks/useDeployments";
import { useProject } from "@/core/api/hooks/useProjects";
import type { Deployment, DeploymentStatus, DeploymentStrategy } from "@forge/types";

// Filter options
const STATUS_FILTERS = [
  { value: "all", label: "All Status", statuses: [] as DeploymentStatus[] },
  {
    value: "active",
    label: "Active",
    statuses: ["PENDING", "QUEUED", "BUILDING", "DEPLOYING", "ROLLBACK"],
  },
  { value: "running", label: "Running", statuses: ["RUNNING"] },
  { value: "succeeded", label: "Succeeded", statuses: ["SUCCEEDED"] },
  { value: "failed", label: "Failed", statuses: ["FAILED"] },
  { value: "cancelled", label: "Cancelled", statuses: ["CANCELLED"] },
  { value: "timed_out", label: "Timed Out", statuses: ["TIMED_OUT"] },
];

const STRATEGY_FILTERS = [
  { value: "all", label: "All Strategies" },
  { value: "ROLLING", label: "Rolling" },
  { value: "BLUE_GREEN", label: "Blue-Green" },
  { value: "CANARY", label: "Canary" },
  { value: "RECREATE", label: "Recreate" },
];

// Helper function to format duration
function formatDuration(deployment: Deployment): string {
  if (!deployment.buildStartedAt) {
    return "-";
  }

  const endTime = deployment.deployCompletedAt ?? deployment.buildCompletedAt ?? new Date();
  const startTime = new Date(deployment.buildStartedAt);
  const end = new Date(endTime);

  const diffMs = end.getTime() - startTime.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);

  if (diffSecs < 60) {
    return `${diffSecs}s`;
  }
  return `${diffMins}m ${diffSecs % 60}s`;
}

// Helper function for relative time
function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return "Just now";
  }
  if (diffMins < 60) {
    return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  }
  if (diffHours < 24) {
    return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  }
  if (diffDays < 7) {
    return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  }
  return date.toLocaleDateString();
}

export function DeploymentsPage(): React.ReactElement {
  const router = useRouter();
  const params = useParams({ from: "/authenticated/projects/$projectId/deployments" });
  const projectId = params.projectId;

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [strategyFilter, setStrategyFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState(1);

  // Fetch project data
  const { data: project, isLoading: projectLoading, error: projectError } = useProject(projectId);

  // Build filter object for API call
  const apiFilters = useMemo(() => {
    const filters: {
      status?: string[];
      strategy?: string;
      search?: string;
      page: number;
      limit: number;
    } = { page, limit: 10 };

    if (statusFilter !== "all") {
      const filterConfig = STATUS_FILTERS.find((f) => f.value === statusFilter);
      if (filterConfig?.statuses.length) {
        filters.status = filterConfig.statuses;
      }
    }

    if (strategyFilter !== "all") {
      filters.strategy = strategyFilter;
    }

    if (searchQuery.trim()) {
      filters.search = searchQuery.trim();
    }

    return filters;
  }, [statusFilter, strategyFilter, searchQuery, page]);

  // Fetch project deployments with server-side filtering
  const {
    data: response,
    isLoading: deploymentsLoading,
    error: deploymentsError,
  } = useProjectDeploymentsWithFilters(projectId, apiFilters);

  const deployments = response?.data ?? [];
  const totalPages = response?.meta.totalPages ?? 1;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [statusFilter, strategyFilter, searchQuery]);

  const isLoading = projectLoading || deploymentsLoading;
  const error = projectError ?? deploymentsError;

  // Handle row click - navigate to deployment logs
  const handleDeploymentClick = (deploymentId: string): void => {
    void router.navigate({
      to: `/projects/${projectId}/deployments/${deploymentId}`,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle>Deployments</CardTitle>
              <CardDescription>
                {project
                  ? `Deployment history for ${project.name}`
                  : "Loading project information..."}
              </CardDescription>
            </div>
            <CardAction>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void router.navigate({ to: `/projects/${projectId}` });
                }}
              >
                Back to Project
              </Button>
            </CardAction>
          </div>
        </CardHeader>
      </Card>

      {/* Filters Card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={strategyFilter} onValueChange={setStrategyFilter}>
              <SelectTrigger size="sm" className="w-40">
                <SelectValue placeholder="Strategy" />
              </SelectTrigger>
              <SelectContent>
                {STRATEGY_FILTERS.map((filter) => (
                  <SelectItem key={filter.value} value={filter.value}>
                    {filter.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by deployment ID..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="py-12">
            <div className="flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
                <p className="mt-4 text-sm text-muted-foreground">Loading deployments...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-medium text-destructive">Failed to load deployments</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {error.message || "An unknown error occurred"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && deployments.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-lg font-medium">No deployments found</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {statusFilter === "all" && strategyFilter === "all" && !searchQuery.trim()
                  ? "This project doesn't have any deployments yet."
                  : "No deployments match your current filters."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Deployments Table */}
      {!isLoading && !error && deployments.length > 0 && (
        <>
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead>Deployment ID</TableHead>
                    <TableHead>Strategy</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deployments.map((deployment) => (
                    <TableRow
                      key={deployment.id}
                      className="cursor-pointer transition-colors hover:bg-muted/50"
                      onClick={() => handleDeploymentClick(deployment.id)}
                    >
                      <TableCell>
                        <StatusIndicator status={deployment.status} size="sm" />
                      </TableCell>

                      <TableCell className="font-medium">
                        <code className="text-sm">{deployment.id.slice(0, 8)}</code>
                      </TableCell>

                      <TableCell>
                        <Badge variant="outline">{deployment.strategy.replace("_", "-")}</Badge>
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {formatDuration(deployment)}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {getRelativeTime(deployment.createdAt as unknown as string)}
                      </TableCell>

                      <TableCell className="text-right">
                        <ButtonGroup>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeploymentClick(deployment.id);
                            }}
                          >
                            <ExternalLinkIcon className="size-4" />
                          </Button>
                        </ButtonGroup>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Server-side pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  {page > 1 ? (
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground cursor-not-allowed opacity-50">
                      Previous
                    </span>
                  )}
                </PaginationItem>

                {/* Show page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }

                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        href="#"
                        isActive={pageNum === page}
                        onClick={(e) => {
                          e.preventDefault();
                          setPage(pageNum);
                        }}
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}

                {totalPages > 5 && page < totalPages - 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}

                <PaginationItem>
                  {page < totalPages ? (
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        setPage((p) => Math.min(totalPages, p + 1));
                      }}
                    />
                  ) : (
                    <span className="text-muted-foreground cursor-not-allowed opacity-50">
                      Next
                    </span>
                  )}
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}
    </div>
  );
}
