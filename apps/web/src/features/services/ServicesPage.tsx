import { useState, useCallback, useMemo } from "react";
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
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/shared/components/ui/empty";
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
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/shared/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  PlusIcon,
  SearchIcon,
  EllipsisIcon,
  EyeIcon,
  PlayIcon,
  SquareIcon,
  RotateCcwIcon,
  Trash2Icon,
  LoaderIcon,
  AlertCircleIcon,
} from "lucide-react";
import { router } from "@/core/router";
import {
  useServices,
  useStartService,
  useStopService,
  useRestartService,
  useDeleteService,
} from "@/core/api/hooks/useServices";
import { ServiceTypeIcon } from "./components/ServiceTypeIcon";
import { ServiceStatusBadge } from "./components/ServiceStatusBadge";
import { CreateServiceModal } from "./components/CreateServiceModal";

type StatusFilter = "all" | "running" | "stopped" | "error";

function getStatusFilterParams(filter: StatusFilter): string[] | undefined {
  switch (filter) {
    case "running":
      return ["RUNNING", "HEALTHY"];
    case "stopped":
      return ["STOPPED"];
    case "error":
      return ["ERROR", "UNHEALTHY"];
    default:
      return undefined;
  }
}

function SkeletonRow(): React.ReactElement {
  return (
    <TableRow className="border-border/50">
      <TableCell>
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-md bg-muted animate-pulse" />
          <div className="flex flex-col gap-1.5">
            <div className="h-3.5 w-28 rounded bg-muted animate-pulse" />
            <div className="h-2.5 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </TableCell>
      <TableCell>
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-5 w-16 rounded-full bg-muted animate-pulse" />
      </TableCell>
      <TableCell>
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
      </TableCell>
      <TableCell className="text-right">
        <div className="h-6 w-6 rounded bg-muted animate-pulse ml-auto" />
      </TableCell>
    </TableRow>
  );
}

export function ServicesPage(): React.ReactElement {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const limit = 15;

  const statusParam = getStatusFilterParams(statusFilter);

  const { data, isLoading, isError, refetch } = useServices({
    page,
    limit,
    status: statusParam,
    search: searchDebounced || undefined,
  });

  const startMutation = useStartService();
  const stopMutation = useStopService();
  const restartMutation = useRestartService();
  const deleteMutation = useDeleteService();

  const [createOpen, setCreateOpen] = useState(false);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    const value = e.target.value;
    const timeout = setTimeout(() => {
      setSearchDebounced(value);
      setPage(1);
    }, 300);
    return (): void => clearTimeout(timeout);
  }, []);

  const handleStatusFilter = useCallback((filter: StatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);

  const handleStart = useCallback(
    (id: string) => {
      void startMutation.mutate(id);
    },
    [startMutation]
  );

  const handleStop = useCallback(
    (id: string) => {
      void stopMutation.mutate(id);
    },
    [stopMutation]
  );

  const handleRestart = useCallback(
    (id: string) => {
      void restartMutation.mutate(id);
    },
    [restartMutation]
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    void deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => setDeleteTarget(null),
    });
  }, [deleteTarget, deleteMutation]);

  const services = data?.data ?? [];
  const totalPages = data?.meta?.totalPages ?? 1;

  const pageNumbers = useMemo(() => {
    const pages: number[] = [];
    const showPages = 5;
    let start = Math.max(1, page - Math.floor(showPages / 2));
    const end = Math.min(totalPages, start + showPages - 1);
    start = Math.max(1, end - showPages + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }, [page, totalPages]);

  return (
    <div className="space-y-6">
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
              <Button
                variant="default"
                size="sm"
                className="group"
                onClick={() => setCreateOpen(true)}
              >
                <PlusIcon className="h-4 w-4 group-hover:scale-110 transition-transform" />
                Create Service
              </Button>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <ButtonGroup>
              {(["all", "running", "stopped", "error"] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={statusFilter === filter ? "default" : "outline"}
                  size="sm"
                  className="font-mono text-[10px] uppercase tracking-wider"
                  onClick={() => handleStatusFilter(filter)}
                >
                  {filter === "all"
                    ? "All"
                    : filter === "running"
                      ? "Running"
                      : filter === "stopped"
                        ? "Stopped"
                        : "Errors"}
                </Button>
              ))}
            </ButtonGroup>

            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search services..."
                className="pl-9 font-sans text-sm"
                value={searchInput}
                onChange={handleSearchChange}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isError ? (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <AlertCircleIcon className="h-8 w-8 text-destructive" />
              <p className="font-sans text-sm text-muted-foreground">Failed to load services</p>
              <Button variant="outline" size="sm" onClick={() => void refetch()}>
                Retry
              </Button>
            </div>
          ) : isLoading ? (
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
                    Engine
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonRow key={i} />
                ))}
              </TableBody>
            </Table>
          ) : services.length === 0 ? (
            <div className="py-16">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle>No services yet</EmptyTitle>
                  <EmptyDescription>
                    Create your first service to get started with databases, caches, and more.
                  </EmptyDescription>
                  <EmptyContent>
                    <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}>
                      <PlusIcon className="h-4 w-4 mr-2" />
                      Create Service
                    </Button>
                  </EmptyContent>
                </EmptyHeader>
              </Empty>
            </div>
          ) : (
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
                    Engine
                  </TableHead>
                  <TableHead className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Created
                  </TableHead>
                  <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Actions
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow
                    key={service.id}
                    className="group hover:bg-muted/30 transition-colors cursor-pointer"
                    onClick={() =>
                      void router.navigate({
                        to: "/services/$serviceId",
                        params: { serviceId: service.id },
                      })
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted transition-colors group-hover:scale-110">
                          <ServiceTypeIcon type={service.type} className="text-muted-foreground" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-sans text-sm font-medium">{service.name}</span>
                          <span className="font-mono text-[10px] text-muted-foreground uppercase">
                            {service.projectId}
                          </span>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <ServiceStatusBadge status={service.status} />
                    </TableCell>

                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] uppercase tracking-wider"
                        >
                          {service.engine ?? "—"}
                        </Badge>
                        {service.version && (
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {service.version}
                          </span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell>
                      <span className="font-mono text-xs text-muted-foreground">
                        {new Date(service.createdAt).toLocaleDateString()}
                      </span>
                    </TableCell>

                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            className="group-hover:scale-110 transition-transform"
                          >
                            <EllipsisIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              void router.navigate({
                                to: "/services/$serviceId",
                                params: { serviceId: service.id },
                              });
                            }}
                          >
                            <EyeIcon className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          {service.status !== "RUNNING" && service.status !== "HEALTHY" && (
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStart(service.id);
                              }}
                              disabled={startMutation.isPending}
                            >
                              <PlayIcon className="h-4 w-4 mr-2" />
                              Start
                            </DropdownMenuItem>
                          )}
                          {(service.status === "RUNNING" || service.status === "HEALTHY") && (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRestart(service.id);
                                }}
                                disabled={restartMutation.isPending}
                              >
                                <RotateCcwIcon className="h-4 w-4 mr-2" />
                                Restart
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStop(service.id);
                                }}
                                disabled={stopMutation.isPending}
                              >
                                <SquareIcon className="h-4 w-4 mr-2" />
                                Stop
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: service.id, name: service.name });
                            }}
                          >
                            <Trash2Icon className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={
                  page === 1
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer font-mono text-[10px] uppercase tracking-wider"
                }
              />
            </PaginationItem>
            {pageNumbers[0] > 1 && (
              <>
                <PaginationItem>
                  <PaginationLink
                    onClick={() => setPage(1)}
                    className="cursor-pointer font-mono text-[10px] uppercase tracking-wider"
                  >
                    1
                  </PaginationLink>
                </PaginationItem>
                {pageNumbers[0] > 2 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
              </>
            )}
            {pageNumbers.map((p) => (
              <PaginationItem key={p}>
                <PaginationLink
                  onClick={() => setPage(p)}
                  isActive={p === page}
                  className="cursor-pointer font-mono text-[10px] uppercase tracking-wider"
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            ))}
            {pageNumbers[pageNumbers.length - 1] < totalPages && (
              <>
                {pageNumbers[pageNumbers.length - 1] < totalPages - 1 && (
                  <PaginationItem>
                    <PaginationEllipsis />
                  </PaginationItem>
                )}
                <PaginationItem>
                  <PaginationLink
                    onClick={() => setPage(totalPages)}
                    className="cursor-pointer font-mono text-[10px] uppercase tracking-wider"
                  >
                    {totalPages}
                  </PaginationLink>
                </PaginationItem>
              </>
            )}
            <PaginationItem>
              <PaginationNext
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className={
                  page === totalPages
                    ? "pointer-events-none opacity-50"
                    : "cursor-pointer font-mono text-[10px] uppercase tracking-wider"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}

      <CreateServiceModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{deleteTarget?.name}</span> and all its
              data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
