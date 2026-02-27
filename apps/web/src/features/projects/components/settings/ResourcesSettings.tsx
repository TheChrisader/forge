import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { PlusIcon, TrashIcon } from "lucide-react";
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

export function ResourcesSettings({ project }: ResourcesSettingsProps): React.ReactElement {
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
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Memory Limits</h3>

        <div className="space-y-2">
          <label htmlFor="memory" className="text-sm font-medium">
            Memory Limit
          </label>
          <div className="flex gap-2">
            <Select
              value={COMMON_MEMORY_VALUES.find((v) => formData.memory === v) || "custom"}
              onValueChange={(value) => {
                if (value !== "custom") {
                  setFormData({ ...formData, memory: value });
                }
              }}
              disabled={updateProject.isPending}
            >
              <SelectTrigger className="w-35">
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
          <p className="text-xs text-muted-foreground">
            Maximum memory allocation (e.g., 512m, 1g, 2g). Leave empty for no limit.
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="memorySwap" className="text-sm font-medium">
            Memory + Swap Limit
          </label>
          <Input
            id="memorySwap"
            value={formData.memorySwap}
            onChange={(e) => setFormData({ ...formData, memorySwap: e.target.value })}
            placeholder="1g"
            disabled={updateProject.isPending}
            className="font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Total memory + swap limit (e.g., 1g). Leave empty for default.
          </p>
        </div>
      </div>

      {/* CPU Limits */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">CPU Limits</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
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
            />
            <p className="text-xs text-muted-foreground">
              Number of CPUs (0.5 = 50%, 2 = 2 cores). Leave empty for no limit.
            </p>
          </div>

          <div className="space-y-2">
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
            />
            <p className="text-xs text-muted-foreground">
              Relative CPU weight (default: 1024). Higher = more CPU.
            </p>
          </div>
        </div>
      </div>

      {/* Volumes */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Volume Mounts</h3>

        {localVolumes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No volumes configured</p>
        ) : (
          <div className="space-y-2">
            {localVolumes.map((volume, index) => (
              <div key={index} className="rounded-md border bg-muted/30 p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-medium">{volume.mountPath}</span>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleOpenEditVolume(index)}
                    >
                      ✏️
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleDeleteVolume(index)}
                    >
                      <TrashIcon />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground">
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
            ))}
          </div>
        )}

        <Button variant="outline" onClick={handleOpenAddVolume} disabled={updateProject.isPending}>
          <PlusIcon />
          Add Volume
        </Button>

        {volumeDialog.isOpen && (
          <div className="rounded-md border bg-background p-4 shadow-sm">
            <h4 className="mb-4 font-semibold">
              {volumeDialog.index !== null ? "Edit Volume" : "Add Volume"}
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
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
                <p className="text-xs text-muted-foreground">Path inside the container</p>
              </div>

              <div className="space-y-2">
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
                <p className="text-xs text-muted-foreground">
                  Leave empty for a named volume. Provide for bind mount.
                </p>
              </div>

              <div className="space-y-2">
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
                <p className="text-xs text-muted-foreground">RW allows writes, RO is read-only</p>
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
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{errors.general}</p>
        </div>
      )}

      <div className="flex justify-end">
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
