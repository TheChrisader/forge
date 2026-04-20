import { useState, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { Alert, AlertTitle, AlertDescription } from "@/shared/components/ui/alert";
import {
  LoaderIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  EyeOffIcon,
  RefreshCwIcon,
  AlertCircleIcon,
  InfoIcon,
} from "lucide-react";
import {
  Combobox,
  ComboboxInput,
  ComboboxContent,
  ComboboxList,
  ComboboxItem,
  ComboboxEmpty,
} from "@/shared/components/ui/combobox";
import { useCreateService, useServiceEngines } from "@/core/api/hooks/useServices";
import { useProjects } from "@/core/api/hooks/useProjects";
import { router } from "@/core/router";
import { ServiceTypeIcon } from "./ServiceTypeIcon";
import type { EngineDetail } from "@/core/api/clients/services";
import type { ServiceType } from "@forge/types";

interface CreateServiceModalProps {
  open: boolean;
  onClose: () => void;
  defaultProjectId?: string;
}

const TYPE_ORDER: ServiceType[] = ["DATABASE", "CACHE", "QUEUE", "STORAGE", "SEARCH", "MONITORING"];

const TYPE_LABELS: Record<string, string> = {
  DATABASE: "Database",
  CACHE: "Cache",
  QUEUE: "Queue",
  STORAGE: "Storage",
  SEARCH: "Search",
  MONITORING: "Monitoring",
};

const DEFAULT_CREDENTIALS: Record<string, { username: string; database: string }> = {
  postgresql: { username: "postgres", database: "app" },
  mysql: { username: "root", database: "app" },
  mongodb: { username: "admin", database: "default" },
  redis: { username: "", database: "" },
  elasticsearch: { username: "elastic", database: "" },
  meilisearch: { username: "", database: "" },
  postgres: { username: "postgres", database: "app" },
  mongo: { username: "admin", database: "default" },
};

function generatePassword(length = 24): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (b) => chars[b % chars.length]).join("");
}

const STEP_TITLES = ["Choose Type", "Choose Engine", "Configure", "Review"];

function StepIndicator({ current, total }: { current: number; total: number }): React.ReactElement {
  return (
    <div className="flex items-center gap-2 py-2">
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className={`h-2 w-2 rounded-full transition-colors ${
              i + 1 <= current ? "bg-primary" : "bg-muted-foreground/30"
            }`}
          />
          {i < total - 1 && (
            <div
              className={`h-px w-8 transition-colors ${
                i + 1 < current ? "bg-primary" : "bg-muted-foreground/30"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function renderConfigOverrides(
  configOverrides: Record<string, string>,
  selectedEngineDetail: EngineDetail | undefined
): React.ReactNode {
  const changed: string[] = [];
  if (selectedEngineDetail) {
    for (const param of selectedEngineDetail.configParameters) {
      if (configOverrides[param.key] !== param.defaultValue) {
        changed.push(`${param.label}: ${configOverrides[param.key]}`);
      }
    }
  }
  if (changed.length === 0) return null;
  return (
    <div className="rounded-lg border border-border/50 divide-y divide-border/50">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-4 pt-3 pb-1">
        Config Overrides
      </p>
      {changed.map((line, i) => (
        <div key={i} className="px-4 py-2">
          <span className="font-mono text-xs">{line}</span>
        </div>
      ))}
    </div>
  );
}

function renderMemoryNote(
  selectedEngineDetail: EngineDetail | undefined,
  version: string
): React.ReactNode {
  const selectedVersion = selectedEngineDetail?.supportedVersions.find(
    (v) => v.version === version
  );
  if (!selectedVersion?.minMemoryMB) return null;
  return (
    <p className="font-sans text-xs text-muted-foreground">
      This engine requires a minimum of {selectedVersion.minMemoryMB}MB memory.
    </p>
  );
}

export function CreateServiceModal({
  open,
  onClose,
  defaultProjectId,
}: CreateServiceModalProps): React.ReactElement {
  const [step, setStep] = useState(1);
  const [selectedType, setSelectedType] = useState<ServiceType | null>(null);
  const [selectedEngine, setSelectedEngine] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(defaultProjectId ?? "");
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState(() => generatePassword());
  const [database, setDatabase] = useState("");
  const [configOverrides, setConfigOverrides] = useState<Record<string, string>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: enginesData, isLoading: enginesLoading } = useServiceEngines();
  const { data: projectsData, isLoading: projectsLoading } = useProjects({ limit: 100 });
  const createMutation = useCreateService();

  const engines = enginesData?.data ?? [];
  const projects = projectsData ?? [];

  const enginesByType = useMemo(() => {
    const grouped: Record<string, typeof engines> = {};
    for (const engine of engines) {
      if (!grouped[engine.type]) grouped[engine.type] = [];
      grouped[engine.type].push(engine);
    }
    return grouped;
  }, [engines]);

  const filteredEngines = useMemo(
    () => (selectedType ? (enginesByType[selectedType] ?? []) : []),
    [enginesByType, selectedType]
  );

  const selectedEngineDetail = useMemo(
    () => engines.find((e) => e.engine === selectedEngine),
    [engines, selectedEngine]
  );

  const reset = useCallback(() => {
    setStep(1);
    setSelectedType(null);
    setSelectedEngine(null);
    setProjectId(defaultProjectId ?? "");
    setName("");
    setVersion("");
    setUsername("");
    setPassword(generatePassword());
    setDatabase("");
    setConfigOverrides({});
    setShowPassword(false);
    setError(null);
  }, [defaultProjectId]);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const selectType = useCallback((type: ServiceType) => {
    setSelectedType(type);
    setSelectedEngine(null);
    setStep(2);
    setError(null);
  }, []);

  const selectEngine = useCallback(
    (engine: string) => {
      setSelectedEngine(engine);
      const detail = engines.find((e) => e.engine === engine);
      if (detail) {
        const defaults = DEFAULT_CREDENTIALS[engine] ??
          DEFAULT_CREDENTIALS[detail.engine.split("-")[0]] ?? {
            username: "admin",
            database: "default",
          };
        setName(`${detail.engine.split("-")[0]}-primary`);
        setVersion(detail.defaultVersion);
        setUsername(defaults.username);
        if (detail.type === "DATABASE") setDatabase(defaults.database);
        const initialConfig: Record<string, string> = {};
        for (const param of detail.configParameters) {
          initialConfig[param.key] = param.defaultValue;
        }
        setConfigOverrides(initialConfig);
      }
      setStep(3);
      setError(null);
    },
    [engines]
  );

  const handleCreate = useCallback(() => {
    if (!projectId || !selectedEngine || !name) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    const payload: Parameters<typeof createMutation.mutate>[0] = {
      projectId,
      name,
      engine: selectedEngine,
      version: version || undefined,
    };

    const isDatabaseType =
      selectedType === "DATABASE" ||
      selectedEngine.startsWith("postgres") ||
      selectedEngine.startsWith("mysql") ||
      selectedEngine.startsWith("mongo") ||
      selectedEngine.startsWith("maria");
    if (username || (isDatabaseType && database)) {
      payload.credentials = {};
      if (username) payload.credentials.username = username;
      if (password) payload.credentials.password = password;
      if (database && isDatabaseType) payload.credentials.database = database;
    }

    const changedConfig: Record<string, string> = {};
    if (selectedEngineDetail) {
      for (const param of selectedEngineDetail.configParameters) {
        if (configOverrides[param.key] !== param.defaultValue) {
          changedConfig[param.key] = configOverrides[param.key];
        }
      }
    }
    if (Object.keys(changedConfig).length > 0) {
      payload.config = changedConfig;
    }

    createMutation.mutate(payload, {
      onSuccess: (result) => {
        handleClose();
        void router.navigate({
          to: "/services/$serviceId",
          params: { serviceId: result.data.id },
        });
      },
      onError: (err) => {
        setError(
          err instanceof Error ? err.message : "Failed to create service. Please try again."
        );
      },
    });
  }, [
    projectId,
    selectedEngine,
    name,
    version,
    selectedType,
    username,
    password,
    database,
    configOverrides,
    selectedEngineDetail,
    createMutation,
    handleClose,
  ]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Service</DialogTitle>
          <DialogDescription>
            Step {step} of 4 — {STEP_TITLES[step - 1]}
          </DialogDescription>
        </DialogHeader>

        <StepIndicator current={step} total={4} />

        {error && (
          <div className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2">
            <AlertCircleIcon className="h-4 w-4 text-destructive shrink-0" />
            <p className="font-sans text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Step 1: Choose Type */}
        {step === 1 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {TYPE_ORDER.filter((type) => (enginesByType[type]?.length ?? 0) > 0).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => selectType(type)}
                className="flex flex-col items-center gap-3 rounded-lg border border-border/50 p-4 transition-all hover:bg-muted/30 hover:border-primary/50 hover:shadow-sm"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <ServiceTypeIcon type={type} className="h-5 w-5 text-primary" />
                </div>
                <div className="text-center">
                  <p className="font-sans text-sm font-medium">{TYPE_LABELS[type] ?? type}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">
                    {enginesByType[type]?.length ?? 0} engines
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Step 2: Choose Engine */}
        {step === 2 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => {
                setStep(1);
                setError(null);
              }}
              className="flex items-center gap-1 font-sans text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeftIcon className="h-3 w-3" />
              Back to types
            </button>
            <div className="grid gap-3">
              {enginesLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />
                  ))
                : filteredEngines.map((engine) => (
                    <button
                      key={engine.engine}
                      type="button"
                      onClick={() => selectEngine(engine.engine)}
                      className="flex items-start gap-4 rounded-lg border border-border/50 p-4 text-left transition-all hover:bg-muted/30 hover:border-primary/50 hover:shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                        <ServiceTypeIcon type={engine.type} className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-sans text-sm font-medium">{engine.displayName}</p>
                          <Badge variant="outline" className="font-mono text-[10px] uppercase">
                            v{engine.defaultVersion}
                          </Badge>
                        </div>
                        <p className="font-sans text-xs text-muted-foreground mt-0.5">
                          {engine.description}
                        </p>
                        <p className="font-mono text-[10px] text-muted-foreground mt-1">
                          {engine.supportedVersions.length} version
                          {engine.supportedVersions.length !== 1 ? "s" : ""} available
                        </p>
                      </div>
                      <ChevronRightIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                    </button>
                  ))}
            </div>
          </div>
        )}

        {/* Step 3: Configure */}
        {step === 3 && selectedEngineDetail && (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => {
                setStep(2);
                setError(null);
              }}
              className="flex items-center gap-1 font-sans text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeftIcon className="h-3 w-3" />
              Back to engines
            </button>

            {/* Project selection */}
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Project <span className="text-destructive">*</span>
              </label>
              <Combobox
                items={projects}
                value={projectId}
                inputValue={projectId}
                onValueChange={(v) => v && setProjectId(v)}
              >
                <ComboboxInput
                  placeholder={projectsLoading ? "Loading projects..." : "Select a project..."}
                  disabled={projectsLoading}
                />
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

            {/* Service name */}
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Service Name <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., postgres-primary"
                maxLength={255}
                className="font-mono text-sm"
              />
            </div>

            {/* Version */}
            <div className="space-y-2">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Version
              </label>
              <Combobox
                items={selectedEngineDetail.supportedVersions}
                value={version}
                inputValue={version}
                onValueChange={(v) => v && setVersion(v)}
              >
                <ComboboxInput placeholder="Select version..." />
                <ComboboxContent>
                  <ComboboxList>
                    <ComboboxEmpty>No versions found</ComboboxEmpty>
                    {selectedEngineDetail.supportedVersions.map((v) => (
                      <ComboboxItem key={v.version} value={v.version}>
                        <div className="flex items-center gap-2">
                          <span>v{v.version}</span>
                          {v.deprecated && (
                            <Badge
                              variant="outline"
                              className="font-mono text-[10px] text-warning-foreground border-warning/50"
                            >
                              deprecated
                            </Badge>
                          )}
                          {v.minMemoryMB && (
                            <span className="font-mono text-[10px] text-muted-foreground">
                              min {v.minMemoryMB}MB
                            </span>
                          )}
                        </div>
                      </ComboboxItem>
                    ))}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            </div>

            {/* Credentials */}
            <div className="space-y-3 rounded-lg border border-border/50 p-4">
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Credentials
              </p>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Username
                </label>
                <Input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  maxLength={255}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Auto-generated"
                    maxLength={500}
                    className="font-mono text-sm pr-20"
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setShowPassword((v) => !v)}
                    >
                      {showPassword ? (
                        <EyeOffIcon className="h-3 w-3" />
                      ) : (
                        <EyeIcon className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => setPassword(generatePassword())}
                    >
                      <RefreshCwIcon className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              {(selectedType === "DATABASE" ||
                selectedEngine?.startsWith("postgres") ||
                selectedEngine?.startsWith("mysql") ||
                selectedEngine?.startsWith("mongo") ||
                selectedEngine?.startsWith("maria")) && (
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    Database
                  </label>
                  <Input
                    value={database}
                    onChange={(e) => setDatabase(e.target.value)}
                    placeholder="app"
                    maxLength={255}
                    className="font-mono text-sm"
                  />
                </div>
              )}
            </div>

            {/* Config overrides */}
            {selectedEngineDetail.configParameters.length > 0 && (
              <div className="space-y-3 rounded-lg border border-border/50 p-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Configuration
                </p>
                {selectedEngineDetail.configParameters.map((param) => (
                  <div key={param.key} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <label className="font-sans text-sm">{param.label}</label>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ({param.key})
                      </span>
                    </div>
                    {param.description && (
                      <p className="font-sans text-xs text-muted-foreground">{param.description}</p>
                    )}
                    {param.type === "boolean" ? (
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={configOverrides[param.key] === "true"}
                          onChange={(e) =>
                            setConfigOverrides((prev) => ({
                              ...prev,
                              [param.key]: e.target.checked ? "true" : "false",
                            }))
                          }
                          className="h-4 w-4 rounded border-border"
                        />
                        <span className="font-mono text-xs text-muted-foreground">
                          {configOverrides[param.key] === "true" ? "Enabled" : "Disabled"}
                        </span>
                      </label>
                    ) : param.type === "integer" ? (
                      <Input
                        type="number"
                        value={configOverrides[param.key] ?? param.defaultValue}
                        onChange={(e) =>
                          setConfigOverrides((prev) => ({
                            ...prev,
                            [param.key]: e.target.value,
                          }))
                        }
                        className="font-mono text-sm"
                      />
                    ) : (
                      <Input
                        value={configOverrides[param.key] ?? param.defaultValue}
                        onChange={(e) =>
                          setConfigOverrides((prev) => ({
                            ...prev,
                            [param.key]: e.target.value,
                          }))
                        }
                        className="font-mono text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 4: Review */}
        {step === 4 && selectedEngineDetail && (
          <div className="space-y-4">
            <div className="rounded-lg border border-border/50 divide-y divide-border/50">
              <div className="flex justify-between px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Project
                </span>
                <span className="font-sans text-sm">
                  {projects.find((p) => p.id === projectId)?.name ?? "—"}
                </span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Name
                </span>
                <span className="font-mono text-sm">{name}</span>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Engine
                </span>
                <div className="flex items-center gap-2">
                  <span className="font-sans text-sm">{selectedEngineDetail.displayName}</span>
                  <Badge variant="outline" className="font-mono text-[10px] uppercase">
                    v{version}
                  </Badge>
                </div>
              </div>
              <div className="flex justify-between px-4 py-3">
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Type
                </span>
                <Badge
                  variant="secondary"
                  className="font-mono text-[10px] uppercase tracking-wider"
                >
                  {TYPE_LABELS[selectedType ?? ""] ?? selectedType}
                </Badge>
              </div>
            </div>

            {(username || password || database) && (
              <div className="rounded-lg border border-border/50 divide-y divide-border/50">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground px-4 pt-3 pb-1">
                  Credentials
                </p>
                {username && (
                  <div className="flex justify-between px-4 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Username
                    </span>
                    <span className="font-mono text-sm">{username}</span>
                  </div>
                )}
                {password && (
                  <div className="flex items-center justify-between px-4 py-2">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Password
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">
                        {showPassword ? password : "••••••••••••••••••••"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setShowPassword((v) => !v)}
                      >
                        {showPassword ? (
                          <EyeOffIcon className="h-3 w-3" />
                        ) : (
                          <EyeIcon className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
                {database && (
                  <div className="flex justify-between px-4 py-2 pb-3">
                    <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                      Database
                    </span>
                    <span className="font-mono text-sm">{database}</span>
                  </div>
                )}
              </div>
            )}

            {renderConfigOverrides(configOverrides, selectedEngineDetail)}

            {renderMemoryNote(selectedEngineDetail, version)}

            <Alert className="bg-muted/50 border-border/50">
              <InfoIcon className="h-4 w-4 text-muted-foreground" />
              <AlertTitle className="text-xs font-medium">Redeployment required</AlertTitle>
              <AlertDescription className="text-xs text-muted-foreground">
                The project will need to be redeployed for this service to be available to its
                containers.
              </AlertDescription>
            </Alert>
          </div>
        )}

        <DialogFooter>
          {step > 1 ? (
            <Button
              variant="outline"
              onClick={() => {
                setStep((s) => s - 1);
                setError(null);
              }}
            >
              <ChevronLeftIcon className="h-4 w-4 mr-1" />
              Back
            </Button>
          ) : (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}
          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={
                (step === 1 && !selectedType) ||
                (step === 2 && !selectedEngine) ||
                (step === 3 && (!projectId || !name))
              }
            >
              Continue
              <ChevronRightIcon className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending || !projectId || !name}
            >
              {createMutation.isPending ? (
                <LoaderIcon className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Service
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
