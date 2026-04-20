import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
  ComboboxTrigger,
} from "@/shared/components/ui/combobox";
import { Badge } from "@/shared/components/ui/badge";
import { Input } from "@/shared/components/ui/input";
import {
  SettingsIcon,
  LinkIcon,
  Trash2Icon,
  AlertTriangleIcon,
  LoaderIcon,
  ArrowUpIcon,
} from "lucide-react";
import {
  useEngineConfig,
  useLinkService,
  useUnlinkService,
  useDeleteService,
  useUpgradeService,
} from "@/core/api/hooks/useServices";
import { useProjects } from "@/core/api/hooks/useProjects";
import { useNavigate } from "@tanstack/react-router";
import type { Service } from "@forge/types";
import { useCallback, useState } from "react";
import { EngineDetail } from "@/core/api";

interface ServiceConfigPanelProps {
  service: Service;
}

export function ServiceConfigPanel({ service }: ServiceConfigPanelProps): React.ReactElement {
  const { data: engineData } = useEngineConfig(service.engine ?? "");
  const engine = engineData?.data;

  const config =
    typeof service.config === "object" && service.config !== null
      ? (service.config as Record<string, unknown>)
      : {};

  const hasOverrides = engine
    ? engine.configParameters.some(
        (p) => config[p.key] !== undefined && config[p.key] !== p.defaultValue
      )
    : Object.keys(config).length > 0;

  return (
    <div className="space-y-6">
      {/* Configuration Card */}
      <Card className="group transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <SettingsIcon className="h-4 w-4 text-primary" />
            </div>
            Configuration
          </CardTitle>
          <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
            {hasOverrides ? "Custom configuration" : "Default configuration"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!hasOverrides ? (
            <p className="font-sans text-sm text-muted-foreground">
              This service is using the default configuration for {service.engine ?? "unknown"}.
            </p>
          ) : (
            <div className="space-y-3">
              {(engine ? engine.configParameters : []).map((param) => {
                const value = config[param.key];
                if (value === undefined || value === param.defaultValue) return null;
                return (
                  <div key={param.key} className="flex items-center justify-between py-1">
                    <div>
                      <p className="font-sans text-sm">{param.label}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{param.key}</p>
                    </div>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {value as string}
                    </Badge>
                  </div>
                );
              })}
              {!engine &&
                Object.entries(config).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <span className="font-mono text-xs">{key}</span>
                    <Badge variant="secondary" className="font-mono text-xs">
                      {value as string}
                    </Badge>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version Upgrade Card */}
      <VersionUpgradeCard service={service} engine={engine} />

      {/* Shared Access Card */}
      {service.isShared && <SharedProjectsPanel serviceId={service.id} />}

      {/* Danger Zone Card */}
      <DangerZoneCard service={service} />
    </div>
  );
}

function VersionUpgradeCard({
  service,
  engine,
}: {
  service: Service;
  engine: EngineDetail | undefined;
}): React.ReactElement {
  const upgradeMutation = useUpgradeService();
  const [selectedVersion, setSelectedVersion] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const currentVersion = service.version ?? engine?.defaultVersion ?? "unknown";
  const availableVersions = (engine?.supportedVersions ?? []).filter(
    (v) => !v.deprecated && v.version !== currentVersion
  );

  const isUpgrading = service.status === "UPGRADING";
  const canUpgrade =
    !isUpgrading &&
    (service.status === "RUNNING" || service.status === "HEALTHY") &&
    availableVersions.length > 0;

  const handleUpgrade = useCallback(() => {
    if (!selectedVersion) return;
    void upgradeMutation.mutate(
      { serviceId: service.id, targetVersion: selectedVersion },
      { onSuccess: () => setConfirmOpen(false) }
    );
  }, [selectedVersion, upgradeMutation, service.id]);

  if (!engine || availableVersions.length === 0) return <></>;

  return (
    <>
      <Card className="group transition-all hover:shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <ArrowUpIcon className="h-4 w-4 text-primary" />
            </div>
            Version
          </CardTitle>
          <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
            {isUpgrading ? "Upgrade in progress..." : `Current: ${currentVersion}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isUpgrading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <LoaderIcon className="h-4 w-4 animate-spin" />
              <span>Service is being upgraded. This may take a few minutes.</span>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Target Version
                </label>
                <Combobox
                  onValueChange={(value) => setSelectedVersion(value ?? "")}
                  value={selectedVersion || undefined}
                >
                  <ComboboxInput
                    placeholder="Select version..."
                    disabled={!canUpgrade || upgradeMutation.isPending}
                  />
                  <ComboboxTrigger />
                  <ComboboxContent>
                    <ComboboxList>
                      <ComboboxEmpty>No versions available</ComboboxEmpty>
                      {availableVersions.map((v) => (
                        <ComboboxItem key={v.version} value={v.version}>
                          {v.version}
                        </ComboboxItem>
                      ))}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
              <Button
                size="sm"
                disabled={!canUpgrade || !selectedVersion || upgradeMutation.isPending}
                onClick={() => setConfirmOpen(true)}
                className="mt-5"
              >
                {upgradeMutation.isPending ? (
                  <LoaderIcon className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <ArrowUpIcon className="h-3.5 w-3.5 mr-1.5" />
                )}
                Upgrade
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upgrade {service.engine}?</DialogTitle>
            <DialogDescription>
              Upgrading from {currentVersion} to {selectedVersion} will create a backup and restart
              the service. The service will be temporarily unavailable during the upgrade.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpgrade} disabled={upgradeMutation.isPending}>
              {upgradeMutation.isPending ? (
                <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Upgrade to {selectedVersion}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function SharedProjectsPanel({ serviceId }: { serviceId: string }): React.ReactElement {
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ limit: 100 });
  const linkMutation = useLinkService();
  const unlinkMutation = useUnlinkService();

  const [unlinkTarget, setUnlinkTarget] = useState<{ id: string; name: string } | null>(null);

  const projects = projectsData ?? [];

  // In a real implementation, you'd fetch the linked projects from the API.
  // For now, the link/unlink mutations are available.

  const handleLink = useCallback(
    (projectId: string) => {
      void linkMutation.mutate({ serviceId, projectId });
    },
    [linkMutation, serviceId]
  );

  const handleUnlink = useCallback(() => {
    if (!unlinkTarget) return;
    void unlinkMutation.mutate(
      { serviceId, projectId: unlinkTarget.id },
      { onSuccess: () => setUnlinkTarget(null) }
    );
  }, [unlinkTarget, unlinkMutation, serviceId]);

  return (
    <>
      <Card className="group transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 font-serif">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
              Shared Access
            </CardTitle>
          </div>
          <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
            Link this service to other projects
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Link Project
            </label>
            <Combobox onValueChange={(value) => value != null && handleLink(value as string)}>
              <ComboboxInput
                placeholder={projectsLoading ? "Loading..." : "Select a project..."}
                disabled={projectsLoading || linkMutation.isPending}
              />
              <ComboboxTrigger />
              <ComboboxContent>
                <ComboboxList>
                  <ComboboxEmpty>No projects found</ComboboxEmpty>
                  {projects.map((project) => (
                    <ComboboxItem key={project.id} value={project.id}>
                      {project.name}
                    </ComboboxItem>
                  ))}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!unlinkTarget} onOpenChange={(open) => !open && setUnlinkTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Unlink Project</DialogTitle>
            <DialogDescription>
              Remove access for{" "}
              <span className="font-medium text-foreground">{unlinkTarget?.name}</span>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUnlinkTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleUnlink}
              disabled={unlinkMutation.isPending}
            >
              {unlinkMutation.isPending ? (
                <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Unlink
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function DangerZoneCard({ service }: { service: Service }): React.ReactElement {
  const deleteMutation = useDeleteService();
  const navigate = useNavigate();

  const [confirmName, setConfirmName] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleDelete = useCallback(() => {
    if (confirmName !== service.name) return;
    void deleteMutation.mutate(service.id, {
      onSuccess: () => {
        void navigate({ to: "/services" });
      },
    });
  }, [confirmName, service, deleteMutation, navigate]);

  return (
    <>
      <Card className="border-destructive/50 group">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 font-serif text-destructive">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <AlertTriangleIcon className="h-4 w-4" />
            </div>
            Danger Zone
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-sans text-sm font-medium">Delete Service</p>
              <p className="font-sans text-xs text-muted-foreground">
                Permanently delete this service and all its data.
              </p>
            </div>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2Icon className="h-3.5 w-3.5 mr-1.5" />
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={(open) => !open && setConfirmOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Service</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-medium text-foreground">{service.name}</span> and all its data.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="font-sans text-sm text-muted-foreground">
              Type <span className="font-mono font-medium text-foreground">{service.name}</span> to
              confirm:
            </p>
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={service.name}
              className="font-mono text-sm"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setConfirmOpen(false);
                setConfirmName("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={confirmName !== service.name || deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Delete Service
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
