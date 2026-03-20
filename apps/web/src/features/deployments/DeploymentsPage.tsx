import { useState, useMemo, useEffect } from "react";
import { useRouter, useParams, Link } from "@tanstack/react-router";
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/components/ui/breadcrumb";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
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
import {
  RocketIcon,
  SearchIcon,
  ClockIcon,
  ActivityIcon,
  FilterIcon,
  ArrowRightIcon,
  SettingsIcon,
} from "lucide-react";
import { useProjectDeploymentsWithFilters } from "@/core/api/hooks/useDeployments";
import { useProject } from "@/core/api/hooks/useProjects";
import type { Deployment, DeploymentStatus as DeploymentStatusType } from "@forge/types";
import { formatDistanceToNow } from "date-fns";

// Filter options
const STATUS_FILTERS = [
  { value: "all", label: "All Status", statuses: [] as DeploymentStatusType[] },
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

  if (diffMs < 1000) return `${diffMs}ms`;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) return `${diffSecs}s`;
  const diffMins = Math.floor(diffSecs / 60);
  return `${diffMins}m ${diffSecs % 60}s`;
}

// Status info helper matching ProjectDetailPage
function getDeploymentStatusInfo(status: string): {
  label: string;
  category: "success" | "progress" | "error" | "warning" | "neutral";
  badgeClass: string;
} {
  const normalized = status.toLowerCase().replace(/_/g, "-");
  if (["running", "succeeded", "healthy"].includes(normalized)) {
    return {
      label: "Live",
      category: "success",
      badgeClass: "border-success-500/50 text-success-500",
    };
  }
  if (["building", "deploying", "pending", "queued"].includes(normalized)) {
    return {
      label: "In Progress",
      category: "progress",
      badgeClass: "border-primary/50 text-primary",
    };
  }
  if (["failed", "error"].includes(normalized)) {
    return {
      label: "Failed",
      category: "error",
      badgeClass: "border-destructive/50 text-destructive",
    };
  }
  return { label: "Inactive", category: "neutral", badgeClass: "" };
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

  // Calculate deployment stats
  const stats = useMemo(() => {
    if (deployments.length === 0) return null;
    const activeCount = deployments.filter((d: Deployment) =>
      ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(d.status)
    ).length;
    const succeededCount = deployments.filter((d: Deployment) => d.status === "SUCCEEDED").length;
    const failedCount = deployments.filter((d: Deployment) => d.status === "FAILED").length;

    return { activeCount, succeededCount, failedCount };
  }, [deployments]);

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/projects">Projects</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{project?.name ?? "Project"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Operational Command Bar */}
      <div className="border-l-2 border-primary/60 bg-primary/3">
        <div className="flex items-center justify-between gap-8 px-5 py-3">
          {/* Left: Status Signal + Stats */}
          <div className="flex items-center gap-6">
            {stats && deployments.length > 0 ? (
              <>
                {/* Status Signal */}
                <div className="flex items-center gap-3">
                  <div className="relative flex items-center justify-center">
                    {/* Outer ring - pulses when active */}
                    {stats.activeCount > 0 && (
                      <div className="absolute h-4 w-4 rounded-full bg-primary/30 animate-ping" />
                    )}
                    {/* Core indicator */}
                    <div
                      className={`relative h-2.5 w-2.5 rounded-full ${
                        stats.activeCount > 0
                          ? "bg-primary shadow-[0_0_12px_rgba(59,130,246,0.4)] animate-pulse"
                          : stats.succeededCount > 0
                            ? "bg-success-500"
                            : "bg-destructive"
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                      Queue Status
                    </span>
                    <span className="text-sm font-semibold">
                      {stats.activeCount > 0 ? `${stats.activeCount} active` : "Idle"}
                    </span>
                  </div>
                </div>

                {/* Vertical separator */}
                <div className="h-8 w-px bg-border" />

                {/* Deployment stats - monospace technical */}
                <div className="hidden sm:flex items-center gap-4 text-xs font-mono">
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">TOTAL</span>
                    <span className="font-medium">{response?.meta.total ?? 0}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">SUCCESS</span>
                    <span className="font-medium text-success-500">{stats.succeededCount}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">FAILED</span>
                    <span className="font-medium text-destructive">{stats.failedCount}</span>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-3">
                <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/50" />
                <div className="flex flex-col">
                  <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                    Queue Status
                  </span>
                  <span className="text-sm text-muted-foreground">No deployments</span>
                </div>
              </div>
            )}
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-3 shrink-0">
            {project && (
              <>
                <span className="hidden md:inline text-xs font-mono text-muted-foreground uppercase tracking-wider">
                  {project.name}
                </span>
                <div className="h-5 w-px bg-border" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => void router.navigate({ to: `/projects/${projectId}` })}
                >
                  <SettingsIcon className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="border-b border-border/50 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm">
            <FilterIcon className="h-4 w-4 text-muted-foreground" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Filters
            </span>
          </div>

          <div className="h-6 w-px bg-border hidden sm:block" />

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

          {(statusFilter !== "all" || strategyFilter !== "all" || searchQuery.trim()) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setStrategyFilter("all");
                setSearchQuery("");
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary/20 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
            <p className="mt-4 text-sm text-muted-foreground">Loading deployments...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {!isLoading && error && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-destructive/10 mb-4">
            <ActivityIcon className="h-7 w-7 text-destructive" />
          </div>
          <p className="font-serif text-lg font-medium text-destructive">
            Failed to load deployments
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {error.message || "An unknown error occurred"}
          </p>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && deployments.length === 0 && (
        <div className="border border-dashed rounded-lg py-16 text-center">
          <div className="flex items-center justify-center w-14 h-14 rounded-lg bg-primary/10 mx-auto mb-4">
            <RocketIcon className="h-7 w-7 text-primary" />
          </div>
          <h3 className="font-serif text-lg font-semibold">No deployments found</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {statusFilter === "all" && strategyFilter === "all" && !searchQuery.trim()
              ? "This project doesn't have any deployments yet."
              : "No deployments match your current filters."}
          </p>
        </div>
      )}

      {/* Deployments Timeline */}
      {!isLoading && !error && deployments.length > 0 && (
        <div className="space-y-6">
          {/* List header */}
          <div className="flex items-center justify-between text-sm">
            <h3 className="font-serif text-lg font-semibold">Deployment History</h3>
            <span className="font-mono text-xs text-muted-foreground">
              {response?.meta.total ?? 0} total
            </span>
          </div>

          {/* Timeline */}
          <div className="space-y-0">
            {deployments.map((deployment: Deployment, index: number) => {
              const statusInfo = getDeploymentStatusInfo(deployment.status);
              const timeAgo = deployment.createdAt
                ? formatDistanceToNow(
                    typeof deployment.createdAt === "string"
                      ? new Date(deployment.createdAt)
                      : deployment.createdAt,
                    { addSuffix: true }
                  )
                : "Unknown";
              const duration = formatDuration(deployment);
              const isActive = ["PENDING", "QUEUED", "BUILDING", "DEPLOYING"].includes(
                deployment.status
              );

              return (
                <div key={deployment.id} className="group">
                  <div
                    className="flex gap-4 px-6 py-4 hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() => handleDeploymentClick(deployment.id)}
                  >
                    {/* Timeline column */}
                    <div className="flex flex-col items-center">
                      <div className="relative">
                        <div
                          className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 transition-transform group-hover:scale-125 ${
                            isActive
                              ? "bg-primary border-primary animate-pulse"
                              : statusInfo.category === "success"
                                ? "bg-success-500 border-success-500"
                                : statusInfo.category === "error"
                                  ? "bg-destructive border-destructive"
                                  : "bg-muted-foreground border-muted-foreground"
                          }`}
                        />
                        {isActive && (
                          <div className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
                        )}
                      </div>
                      {index < deployments.length - 1 && (
                        <div className="w-0.5 flex-1 mt-2 min-h-12 bg-border" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Icon */}
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors group-hover:scale-110 ${
                              isActive
                                ? "bg-primary/10"
                                : statusInfo.category === "success"
                                  ? "bg-success-500/10"
                                  : statusInfo.category === "error"
                                    ? "bg-destructive/10"
                                    : "bg-muted"
                            }`}
                          >
                            <RocketIcon
                              className={`h-4 w-4 ${
                                isActive
                                  ? "text-primary"
                                  : statusInfo.category === "success"
                                    ? "text-success-500"
                                    : statusInfo.category === "error"
                                      ? "text-destructive"
                                      : "text-muted-foreground"
                              }`}
                            />
                          </div>

                          {/* Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <code className="font-mono text-sm font-medium">
                                {deployment.id.slice(0, 8)}
                              </code>
                              {deployment.strategy && (
                                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {deployment.strategy.replace("_", "-")}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1.5 font-mono">
                                <ClockIcon className="h-3 w-3" />
                                {timeAgo}
                              </span>
                              {duration !== "-" && (
                                <>
                                  <span className="text-muted-foreground/50">•</span>
                                  <span className="flex items-center gap-1.5 font-mono">
                                    <ActivityIcon className="h-3 w-3" />
                                    {duration}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Status and arrow */}
                        <div className="flex items-center gap-3 shrink-0">
                          <Badge variant="outline" className={statusInfo.badgeClass}>
                            {statusInfo.label}
                          </Badge>
                          <ArrowRightIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                      </div>
                    </div>
                  </div>
                  {index < deployments.length - 1 && <Separator />}
                </div>
              );
            })}
          </div>

          {/* Server-side pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center pt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    {page > 1 ? (
                      <PaginationPrevious
                        href="#"
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          setPage((p) => Math.max(1, p - 1));
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground cursor-not-allowed opacity-50 text-sm">
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
                          onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                            e.preventDefault();
                            setPage(pageNum);
                          }}
                          className={pageNum === page ? "font-mono" : ""}
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
                        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
                          e.preventDefault();
                          setPage((p) => Math.min(totalPages, p + 1));
                        }}
                      />
                    ) : (
                      <span className="text-muted-foreground cursor-not-allowed opacity-50 text-sm">
                        Next
                      </span>
                    )}
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
