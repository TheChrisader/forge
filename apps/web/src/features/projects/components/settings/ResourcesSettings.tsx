import { JSX, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface ResourcesSettingsProps {
  project: Project;
}

interface VolumeConfig {
  mountPath: string;
  hostPath?: string;
  mode: "RW" | "RO";
}

interface VolumeDialog {
  isOpen: boolean;
  index: number | null;
  volume: VolumeConfig;
}

interface FormErrors {
  general?: string;
  mountPath?: string;
}

const COMMON_MEMORY_VALUES = ["256m", "512m", "1g", "2g", "4g"] as const;

export function ResourcesSettings({ project }: ResourcesSettingsProps): JSX.Element {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const resourcesConfig = (config.resources as Record<string, unknown> | undefined) || {};
  const volumesConfig = (config.volumes as VolumeConfig[] | undefined) || [];

  const [formData, setFormData] = useState({
    memory: (resourcesConfig.memory as string | undefined) || "",
    memorySwap: (resourcesConfig.memorySwap as string | undefined) || "",
    cpus: (resourcesConfig.cpus as number | undefined) ?? "",
    cpuShares: (resourcesConfig.cpuShares as number | undefined) ?? "",
  });

  const [localVolumes, setLocalVolumes] = useState<VolumeConfig[]>(
    volumesConfig.length > 0 ? volumesConfig : []
  );

  const [volumeDialog, setVolumeDialog] = useState<VolumeDialog>({
    isOpen: false,
    index: null,
    volume: { mountPath: "", hostPath: "", mode: "RW" },
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const updateProject = usePatchProject();

  const handleOpenAddVolume = (): void => {
    setVolumeDialog({
      isOpen: true,
      index: null,
      volume: { mountPath: "", hostPath: "", mode: "RW" },
    });
    setErrors({});
  };

  const handleOpenEditVolume = (index: number): void => {
    setVolumeDialog({
      isOpen: true,
      index,
      volume: { ...localVolumes[index] },
    });
    setErrors({});
  };

  const handleCloseVolumeDialog = (): void => {
    setVolumeDialog({
      isOpen: false,
      index: null,
      volume: { mountPath: "", hostPath: "", mode: "RW" },
    });
    setErrors({});
  };

  const handleSaveVolume = (): void => {
    setErrors({});

    if (!volumeDialog.volume.mountPath) {
      setErrors({ mountPath: "Mount path is required" });
      return;
    }

    const newVolumes = [...localVolumes];
    if (volumeDialog.index !== null) {
      newVolumes[volumeDialog.index] = volumeDialog.volume;
    } else {
      newVolumes.push(volumeDialog.volume);
    }

    setLocalVolumes(newVolumes);
    handleCloseVolumeDialog();
  };

  const handleDeleteVolume = (index: number): void => {
    const newVolumes = [...localVolumes];
    newVolumes.splice(index, 1);
    setLocalVolumes(newVolumes);
  };

  const handleSave = async (): Promise<void> => {
    setErrors({});

    if (formData.cpus && isNaN(Number(formData.cpus))) {
      setErrors({ general: "Invalid CPU value" });
      return;
    }
    if (formData.cpuShares && isNaN(Number(formData.cpuShares))) {
      setErrors({ general: "Invalid CPU shares value" });
      return;
    }

    const memoryPattern = /^\d+(\.\d+)?(m|g|mb|gb)$/i;
    if (formData.memory && !memoryPattern.test(formData.memory)) {
      setErrors({ general: "Invalid memory format. Use format like 512m or 1g" });
      return;
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            resources: {
              ...(typeof resourcesConfig === "object" ? resourcesConfig : {}),
              memory: formData.memory || undefined,
              memorySwap: formData.memorySwap || undefined,
              cpus: formData.cpus ? Number(formData.cpus) : undefined,
              cpuShares: formData.cpuShares ? Number(formData.cpuShares) : undefined,
            },
            volumes: localVolumes.length > 0 ? localVolumes : undefined,
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  const hasChanges =
    JSON.stringify(formData) !==
      JSON.stringify({
        memory: (resourcesConfig.memory as string | undefined) || "",
        memorySwap: (resourcesConfig.memorySwap as string | undefined) || "",
        cpus: (resourcesConfig.cpus as number | undefined) ?? "",
        cpuShares: (resourcesConfig.cpuShares as number | undefined) ?? "",
      }) || JSON.stringify(localVolumes) !== JSON.stringify(volumesConfig);

  return (
    <div className="space-y-6">
      {/* Memory Limits */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Memory Limits
        </div>

        <div className="gap-2 flex flex-col">
          <label htmlFor="memory" className="text-sm font-medium">
            Memory Limit
          </label>
          <div className="flex gap-2 max-w-md">
            <Select
              value={COMMON_MEMORY_VALUES.find((v) => formData.memory === v) || "custom"}
              onValueChange={(value) => {
                if (value !== "custom") {
                  setFormData({ ...formData, memory: value });
                }
              }}
              disabled={updateProject.isPending}
            >
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Preset" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_MEMORY_VALUES.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
            <Input
              id="memory"
              value={formData.memory}
              onChange={(e) => setFormData({ ...formData, memory: e.target.value })}
              placeholder="512m"
              disabled={updateProject.isPending}
              className="font-mono"
            />
          </div>
          <p className="text-xs text-muted-foreground font-mono">Leave empty for no limit</p>
        </div>

        <div className="gap-2 flex flex-col">
          <label htmlFor="memorySwap" className="text-sm font-medium">
            Memory + Swap Limit
          </label>
          <Input
            id="memorySwap"
            value={formData.memorySwap}
            onChange={(e) => setFormData({ ...formData, memorySwap: e.target.value })}
            placeholder="1g"
            disabled={updateProject.isPending}
            className="font-mono max-w-md"
          />
          <p className="text-xs text-muted-foreground font-mono">Total memory + swap limit</p>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* CPU Limits */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          CPU Limits
        </div>

        <div className="grid grid-cols-2 gap-4 max-w-2xl">
          <div className="gap-2 flex flex-col">
            <label htmlFor="cpus" className="text-sm font-medium">
              CPU Limit
            </label>
            <Input
              id="cpus"
              type="number"
              step="0.1"
              min="0"
              value={formData.cpus}
              onChange={(e) => setFormData({ ...formData, cpus: e.target.value })}
              placeholder="0.5"
              disabled={updateProject.isPending}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">0.5 = 50%, 2 = 2 cores</p>
          </div>

          <div className="gap-2 flex flex-col">
            <label htmlFor="cpuShares" className="text-sm font-medium">
              CPU Shares
            </label>
            <Input
              id="cpuShares"
              type="number"
              min="0"
              value={formData.cpuShares}
              onChange={(e) => setFormData({ ...formData, cpuShares: e.target.value })}
              placeholder="1024"
              disabled={updateProject.isPending}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">
              Relative weight (default: 1024)
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Volumes */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Volume Mounts
        </div>

        {localVolumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No volumes configured</p>
        ) : (
          <div className="gap-2 flex flex-col">
            {localVolumes.map((volume, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-border/40 rounded-sm bg-muted/10 group"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-sm font-medium">{volume.mountPath}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {volume.hostPath ? (
                      <>
                        Host: <span className="font-mono">{volume.hostPath}</span> • Mode:{" "}
                        {volume.mode}
                      </>
                    ) : (
                      <>Named volume • Mode: {volume.mode}</>
                    )}
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleOpenEditVolume(index)}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteVolume(index)}
                    className="text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button variant="outline" onClick={handleOpenAddVolume} disabled={updateProject.isPending}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add Volume
        </Button>

        {volumeDialog.isOpen && (
          <div className="border border-border/60 rounded-sm bg-background p-4 shadow-sm">
            <h4 className="mb-4 font-semibold text-sm">
              {volumeDialog.index !== null ? "Edit Volume" : "Add Volume"}
            </h4>
            <div className="space-y-4">
              <div className="gap-2 flex flex-col">
                <label htmlFor="mountPath" className="text-sm font-medium">
                  Mount Path *
                </label>
                <Input
                  id="mountPath"
                  value={volumeDialog.volume.mountPath}
                  onChange={(e) =>
                    setVolumeDialog({
                      ...volumeDialog,
                      volume: { ...volumeDialog.volume, mountPath: e.target.value },
                    })
                  }
                  placeholder="/app/data"
                  className="font-mono"
                />
                {errors.mountPath && <p className="text-sm text-destructive">{errors.mountPath}</p>}
                <p className="text-xs text-muted-foreground font-mono">Path inside the container</p>
              </div>

              <div className="gap-2 flex flex-col">
                <label htmlFor="hostPath" className="text-sm font-medium">
                  Host Path (Optional)
                </label>
                <Input
                  id="hostPath"
                  value={volumeDialog.volume.hostPath || ""}
                  onChange={(e) =>
                    setVolumeDialog({
                      ...volumeDialog,
                      volume: { ...volumeDialog.volume, hostPath: e.target.value || undefined },
                    })
                  }
                  placeholder="/host/path"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground font-mono">
                  Leave empty for a named volume
                </p>
              </div>

              <div className="gap-2 flex flex-col">
                <label htmlFor="mode" className="text-sm font-medium">
                  Mode
                </label>
                <Select
                  value={volumeDialog.volume.mode}
                  onValueChange={(value) =>
                    setVolumeDialog({
                      ...volumeDialog,
                      volume: { ...volumeDialog.volume, mode: value as "RW" | "RO" },
                    })
                  }
                >
                  <SelectTrigger id="mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RW">Read-Write (RW)</SelectItem>
                    <SelectItem value="RO">Read-Only (RO)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseVolumeDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSaveVolume}>
                  {volumeDialog.index !== null ? "Update" : "Add"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {errors.general && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-destructive">{errors.general}</p>
        </div>
      )}

      <div className="flex justify-end pt-2">
        <Button
          onClick={() => {
            void handleSave();
          }}
          disabled={updateProject.isPending || !hasChanges}
        >
          {updateProject.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
