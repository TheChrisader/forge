import { useState, useEffect, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/shared/components/ui/select";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
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
  RefreshCwIcon,
  SearchIcon,
  ActivityIcon,
  PlusCircleIcon,
  PencilIcon,
  TrashIcon,
  ClockIcon,
} from "lucide-react";
import { useAuditLogs } from "@/core/api/hooks/useAuditLogs";
import { useQueryClient } from "@tanstack/react-query";
import { auditLogKeys } from "@/core/api/hooks/useAuditLogs";
import type { AuditLog } from "@forge/types";
import { formatDistanceToNow, subDays } from "date-fns";
import { Separator } from "@/shared/components/ui/separator";

const DEFAULT_PAGE_SIZE = 25;
const DEFAULT_DATE_RANGE_DAYS = 7;

const RESOURCE_TYPE_OPTIONS = [
  { value: "", label: "All Resources" },
  { value: "projects", label: "Projects" },
  { value: "deployments", label: "Deployments" },
  { value: "containers", label: "Containers" },
  { value: "domains", label: "Domains" },
  { value: "secrets", label: "Secrets" },
  { value: "environment-variables", label: "Environment Variables" },
  { value: "api-keys", label: "API Keys" },
  { value: "invitations", label: "Invitations" },
  { value: "images", label: "Images" },
] as const;

const ACTION_OPTIONS = [
  { value: "", label: "All Actions" },
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
] as const;

type ActionVerb = "create" | "update" | "delete";

const ACTION_ICONS: Record<ActionVerb, React.ReactNode> = {
  create: <PlusCircleIcon className="size-4" />,
  update: <PencilIcon className="size-4" />,
  delete: <TrashIcon className="size-4" />,
};

function getActionVerb(action: string): ActionVerb | null {
  const parts = action.split(".");
  const verb = parts[parts.length - 1];
  if (verb === "create" || verb === "update" || verb === "delete") return verb;
  return null;
}

function formatTimestamp(timestamp: string | Date): string {
  const date = typeof timestamp === "string" ? new Date(timestamp) : timestamp;
  return formatDistanceToNow(date, { addSuffix: true });
}

function truncateResourceId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}...` : id;
}

export function ActivityPage(): React.ReactElement {
  const queryClient = useQueryClient();

  const [resourceType, setResourceType] = useState("");
  const [action, setAction] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const sinceDefault = useMemo(
    () => subDays(new Date(), DEFAULT_DATE_RANGE_DAYS).toISOString(),
    []
  );
  const [since, setSince] = useState(sinceDefault);
  const [until, setUntil] = useState("");

  const queryParams = useMemo(() => {
    const params: {
      resourceType?: string;
      action?: string;
      search?: string;
      since?: string;
      until?: string;
      page: number;
      limit: number;
    } = {
      page,
      limit: DEFAULT_PAGE_SIZE,
    };

    if (resourceType) params.resourceType = resourceType;
    if (action) params.action = action;
    if (search.trim()) params.search = search.trim();
    if (since) params.since = since;
    if (until) params.until = until;

    return params;
  }, [resourceType, action, search, since, until, page]);

  const { data, isLoading, isError, refetch } = useAuditLogs(queryParams);

  const items: AuditLog[] = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  useEffect(() => {
    setPage(1);
  }, [resourceType, action, search, since, until]);

  const hasActiveFilters = !!(resourceType || action || search.trim() || since || until);

  const handleRefresh = (): void => {
    void refetch();
  };

  const handleClearFilters = (): void => {
    setResourceType("");
    setAction("");
    setSearch("");
    setSince(sinceDefault);
    setUntil("");
  };

  const handleRetry = (): void => {
    void queryClient.invalidateQueries({ queryKey: auditLogKeys.all });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCwIcon />
              Refresh
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Select
              value={resourceType || "_all"}
              onValueChange={(v) => setResourceType(v === "_all" ? "" : v)}
            >
              <SelectTrigger size="sm" className="w-44">
                <SelectValue placeholder="Resource type" />
              </SelectTrigger>
              <SelectContent>
                {RESOURCE_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value || "_all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={action || "_all"}
              onValueChange={(v) => setAction(v === "_all" ? "" : v)}
            >
              <SelectTrigger size="sm" className="w-36">
                <SelectValue placeholder="Action" />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value || "_all"}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              className="w-40"
              value={since ? since.split("T")[0] : ""}
              onChange={(e) =>
                setSince(e.target.value ? new Date(e.target.value).toISOString() : "")
              }
              placeholder="Since"
            />
            <Input
              type="date"
              className="w-40"
              value={until ? until.split("T")[0] : ""}
              onChange={(e) =>
                setUntil(e.target.value ? new Date(e.target.value).toISOString() : "")
              }
              placeholder="Until"
            />

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or action..."
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isLoading && <ActivitySkeleton />}

      {isError && (
        <Card>
          <CardContent className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>Failed to load activity</EmptyTitle>
                <EmptyDescription>Something went wrong. Try refreshing the page.</EmptyDescription>
              </EmptyHeader>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                Retry
              </Button>
            </Empty>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && items.length === 0 && (
        <Card>
          <CardContent className="py-16">
            <Empty>
              <EmptyHeader>
                <EmptyTitle>
                  {hasActiveFilters ? "No matching activity" : "No activity yet"}
                </EmptyTitle>
                <EmptyDescription>
                  {hasActiveFilters
                    ? "Try adjusting your filters or date range."
                    : "Actions performed in Forge will appear here."}
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}

      {!isLoading && !isError && items.length > 0 && (
        <>
          <div className="flex items-center justify-between text-sm">
            <h3 className="font-serif text-lg font-semibold">Activity Log</h3>
            <span className="font-mono text-xs text-muted-foreground">{total} total</span>
          </div>

          <Card>
            <CardContent className="p-0 divide-y divide-border/50">
              {items.map((entry) => (
                <ActivityItem key={`${entry.id}`} entry={entry} />
              ))}
            </CardContent>
          </Card>

          {totalPages > 1 && (
            <div className="flex items-center justify-center pt-4">
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
                      <span className="text-muted-foreground cursor-not-allowed opacity-50 text-sm">
                        Previous
                      </span>
                    )}
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum: number;
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
                        onClick={(e) => {
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
        </>
      )}
    </div>
  );
}

function ActivityItem({ entry }: { entry: AuditLog }): React.ReactElement {
  const verb = getActionVerb(entry.action);
  const icon = verb ? ACTION_ICONS[verb] : <ActivityIcon className="size-5" />;
  const iconColorClass =
    verb === "delete"
      ? "text-destructive bg-destructive/10"
      : verb === "create"
        ? "text-success-500 bg-success-500/10"
        : "text-primary bg-primary/10";

  const resourceType = entry.resourceType;
  const verbLabel = verb ?? "action";

  return (
    <div className="flex gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconColorClass}`}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium truncate">{entry.userEmail ?? "System"}</span>
          <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
            <ClockIcon className="size-3" />
            {formatTimestamp(entry.timestamp)}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
          <span className="font-medium capitalize">{verbLabel}</span>
          <span>{resourceType}</span>
          <Separator orientation="vertical" className="h-3" />
          {entry.ipAddress && (
            <span className="font-mono text-muted-foreground/60">{entry.ipAddress}</span>
          )}
        </div>
        {entry.resourceId && (
          <span className="mt-0.5 inline-block font-mono text-[11px] text-muted-foreground/50">
            {truncateResourceId(entry.resourceId)}
          </span>
        )}
      </div>
    </div>
  );
}

function ActivitySkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="p-0 divide-y divide-border/50">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded-lg bg-muted" />
            <div className="flex-1 space-y-2">
              <div className="flex justify-between">
                <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                <div className="h-3 w-16 animate-pulse rounded bg-muted" />
              </div>
              <div className="h-3 w-56 animate-pulse rounded bg-muted" />
              <div className="h-3 w-24 animate-pulse rounded bg-muted" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
