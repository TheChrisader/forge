import { JSX, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface ContainerSettingsProps {
  project: Project;
}

interface LabelDialog {
  isOpen: boolean;
  key: string;
  value: string;
  editMode: boolean;
  editingKey?: string;
}

interface FormErrors {
  general?: string;
  labelKey?: string;
}

export function ContainerSettings({ project }: ContainerSettingsProps): JSX.Element {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const containerConfig = (config.container as Record<string, unknown> | undefined) || {};
  const capabilitiesConfig =
    (containerConfig.capabilities as Record<string, unknown> | undefined) || {};

  const labels = (containerConfig.labels as Record<string, string> | undefined) || {};

  const [formData, setFormData] = useState({
    readOnlyRootFs: (containerConfig.readOnlyRootFs as boolean | undefined) ?? false,
    capabilitiesAdd: arrayToString(capabilitiesConfig.add as string[] | undefined),
    capabilitiesDrop: arrayToString(capabilitiesConfig.drop as string[] | undefined),
    securityOpts: arrayToString(containerConfig.securityOpts as string[] | undefined),
    privileged: (containerConfig.privileged as boolean | undefined) ?? false,
    hostPid: (containerConfig.hostPid as boolean | undefined) ?? false,
    hostNetwork: (containerConfig.hostNetwork as boolean | undefined) ?? false,
  });

  const [localLabels, setLocalLabels] = useState<Record<string, string>>(labels);
  const [dialog, setDialog] = useState<LabelDialog>({
    isOpen: false,
    key: "",
    value: "",
    editMode: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateProject = usePatchProject();

  const handleOpenAddDialog = (): void => {
    setDialog({ isOpen: true, key: "", value: "", editMode: false });
    setErrors({});
  };

  const handleOpenEditDialog = (key: string): void => {
    setDialog({
      isOpen: true,
      key,
      value: localLabels[key] || "",
      editMode: true,
      editingKey: key,
    });
    setErrors({});
  };

  const handleCloseDialog = (): void => {
    setDialog({ isOpen: false, key: "", value: "", editMode: false });
    setErrors({});
  };

  const handleSaveLabel = (): void => {
    setErrors({});

    if (!dialog.key) {
      setErrors({ labelKey: "Key is required" });
      return;
    }

    if (!dialog.editMode && localLabels[dialog.key]) {
      setErrors({ labelKey: "This key already exists" });
      return;
    }

    const newLabels = { ...localLabels };
    if (dialog.editMode && dialog.editingKey && dialog.editingKey !== dialog.key) {
      delete newLabels[dialog.editingKey];
    }
    newLabels[dialog.key] = dialog.value;

    setLocalLabels(newLabels);
    handleCloseDialog();
  };

  const handleDeleteLabel = (key: string): void => {
    const newLabels = { ...localLabels };
    delete newLabels[key];
    setLocalLabels(newLabels);
  };

  const handleSave = async (): Promise<void> => {
    setErrors({});

    try {
      const capabilities: Record<string, string[] | undefined> = {};
      if (formData.capabilitiesAdd) {
        capabilities.add = stringToArray(formData.capabilitiesAdd);
      }
      if (formData.capabilitiesDrop) {
        capabilities.drop = stringToArray(formData.capabilitiesDrop);
      }

      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            container: {
              ...(typeof containerConfig === "object" ? containerConfig : {}),
              labels: Object.keys(localLabels).length > 0 ? localLabels : undefined,
              readOnlyRootFs: formData.readOnlyRootFs || undefined,
              capabilities: Object.keys(capabilities).length > 0 ? capabilities : undefined,
              securityOpts: formData.securityOpts
                ? stringToArray(formData.securityOpts)
                : undefined,
              privileged: formData.privileged || undefined,
              hostPid: formData.hostPid || undefined,
              hostNetwork: formData.hostNetwork || undefined,
            },
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  const hasChanges =
    JSON.stringify(localLabels) !== JSON.stringify(labels) ||
    JSON.stringify(formData) !==
      JSON.stringify({
        readOnlyRootFs: (containerConfig.readOnlyRootFs as boolean | undefined) ?? false,
        capabilitiesAdd: arrayToString(capabilitiesConfig.add as string[] | undefined),
        capabilitiesDrop: arrayToString(capabilitiesConfig.drop as string[] | undefined),
        securityOpts: arrayToString(containerConfig.securityOpts as string[] | undefined),
        privileged: (containerConfig.privileged as boolean | undefined) ?? false,
        hostPid: (containerConfig.hostPid as boolean | undefined) ?? false,
        hostNetwork: (containerConfig.hostNetwork as boolean | undefined) ?? false,
      });

  return (
    <div className="space-y-6">
      {/* Labels Section */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Container Labels
        </div>
        <div className="gap-2 flex flex-col">
          {Object.entries(localLabels).length === 0 ? (
            <p className="text-sm text-muted-foreground">No labels configured</p>
          ) : (
            <div className="gap-2 flex flex-col">
              {Object.entries(localLabels).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 border border-border/40 rounded-sm bg-muted/10 group"
                >
                  <div className="flex-1 font-mono text-sm truncate">{key}</div>
                  <div className="flex-2 font-mono text-sm text-muted-foreground truncate">
                    {value}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleOpenEditDialog(key)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleDeleteLabel(key)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={handleOpenAddDialog} disabled={updateProject.isPending}>
          <PlusIcon className="h-4 w-4 mr-1.5" />
          Add Label
        </Button>

        {dialog.isOpen && (
          <div className="border border-border/60 rounded-sm bg-background p-4 shadow-sm">
            <h4 className="mb-4 font-semibold text-sm">
              {dialog.editMode ? "Edit Label" : "Add Label"}
            </h4>
            <div className="space-y-4">
              <div className="gap-2 flex flex-col">
                <label htmlFor="label-key" className="text-sm font-medium">
                  Key
                </label>
                <Input
                  id="label-key"
                  value={dialog.key}
                  onChange={(e) => setDialog({ ...dialog, key: e.target.value })}
                  placeholder="com.example.label"
                  className="font-mono"
                />
                {errors.labelKey && <p className="text-sm text-destructive">{errors.labelKey}</p>}
              </div>
              <div className="gap-2 flex flex-col">
                <label htmlFor="label-value" className="text-sm font-medium">
                  Value
                </label>
                <Input
                  id="label-value"
                  value={dialog.value}
                  onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                  placeholder="label-value"
                  className="font-mono"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button onClick={handleSaveLabel}>{dialog.editMode ? "Update" : "Add"}</Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/40" />

      {/* Security Options */}
      <div className="space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Security
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <label htmlFor="readOnlyRootFs" className="text-sm font-medium">
              Read-only Root Filesystem
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Makes the container root filesystem mounted read-only
            </p>
          </div>
          <Switch
            id="readOnlyRootFs"
            checked={formData.readOnlyRootFs}
            onCheckedChange={(checked) => setFormData({ ...formData, readOnlyRootFs: checked })}
            disabled={updateProject.isPending}
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <label htmlFor="privileged" className="text-sm font-medium">
              Privileged Mode
            </label>
            <p className="text-xs text-destructive mt-0.5">
              Gives container full access to host devices
            </p>
          </div>
          <Switch
            id="privileged"
            checked={formData.privileged}
            onCheckedChange={(checked) => setFormData({ ...formData, privileged: checked })}
            disabled={updateProject.isPending}
          />
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Linux Capabilities */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Linux Capabilities
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="gap-2 flex flex-col">
            <label htmlFor="capabilitiesAdd" className="text-sm font-medium">
              Add Capabilities
            </label>
            <Input
              id="capabilitiesAdd"
              value={formData.capabilitiesAdd}
              onChange={(e) => setFormData({ ...formData, capabilitiesAdd: e.target.value })}
              placeholder="NET_ADMIN, SYS_TIME"
              disabled={updateProject.isPending}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">Comma-separated values</p>
          </div>

          <div className="gap-2 flex flex-col">
            <label htmlFor="capabilitiesDrop" className="text-sm font-medium">
              Drop Capabilities
            </label>
            <Input
              id="capabilitiesDrop"
              value={formData.capabilitiesDrop}
              onChange={(e) => setFormData({ ...formData, capabilitiesDrop: e.target.value })}
              placeholder="ALL, NET_RAW"
              disabled={updateProject.isPending}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">Comma-separated values</p>
          </div>
        </div>

        <div className="gap-2 flex flex-col">
          <label htmlFor="securityOpts" className="text-sm font-medium">
            Security Options
          </label>
          <Input
            id="securityOpts"
            value={formData.securityOpts}
            onChange={(e) => setFormData({ ...formData, securityOpts: e.target.value })}
            placeholder="seccomp=default, apparmor=docker-default"
            disabled={updateProject.isPending}
            className="font-mono max-w-lg"
          />
          <p className="text-xs text-muted-foreground font-mono">
            seccomp, apparmor, no-new-privileges
          </p>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Namespace Options */}
      <div className="space-y-4">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Namespace Options
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <label htmlFor="hostPid" className="text-sm font-medium">
              Host PID Namespace
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">Use host process ID namespace</p>
          </div>
          <Switch
            id="hostPid"
            checked={formData.hostPid}
            onCheckedChange={(checked) => setFormData({ ...formData, hostPid: checked })}
            disabled={updateProject.isPending}
          />
        </div>

        <div className="flex items-center justify-between py-1">
          <div>
            <label htmlFor="hostNetwork" className="text-sm font-medium">
              Host Network Namespace
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">Use host network namespace</p>
          </div>
          <Switch
            id="hostNetwork"
            checked={formData.hostNetwork}
            onCheckedChange={(checked) => setFormData({ ...formData, hostNetwork: checked })}
            disabled={updateProject.isPending}
          />
        </div>
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

function arrayToString(value: string[] | undefined): string {
  if (!value) return "";
  return value.join(", ");
}

function stringToArray(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
