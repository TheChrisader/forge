import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Switch } from "@/shared/components/ui/switch";
import { PlusIcon, TrashIcon } from "lucide-react";
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

export function ContainerSettings({ project }: ContainerSettingsProps): React.ReactElement {
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
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Container Labels</h3>
        <div className="space-y-2">
          {Object.entries(localLabels).length === 0 ? (
            <p className="text-sm text-muted-foreground">No labels configured</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(localLabels).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input value={key} disabled className="flex-1 font-mono text-sm" />
                  <Input value={value} disabled className="flex-2 font-mono text-sm" />
                  <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEditDialog(key)}>
                    ✏️
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteLabel(key)}>
                    <TrashIcon />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <Button variant="outline" onClick={handleOpenAddDialog} disabled={updateProject.isPending}>
          <PlusIcon />
          Add Label
        </Button>

        {dialog.isOpen && (
          <div className="rounded-md border bg-background p-4 shadow-sm">
            <h4 className="mb-4 font-semibold">{dialog.editMode ? "Edit Label" : "Add Label"}</h4>
            <div className="space-y-4">
              <div className="space-y-2">
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
              <div className="space-y-2">
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

      {/* Security Options */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Security</h3>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="readOnlyRootFs" className="text-sm font-medium">
              Read-only Root Filesystem
            </label>
            <p className="text-xs text-muted-foreground">
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

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="privileged" className="text-sm font-medium">
              Privileged Mode
            </label>
            <p className="text-xs text-destructive">
              Gives container full access to host devices (not recommended)
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

      {/* Linux Capabilities */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Linux Capabilities</h3>

        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            Comma-separated Linux capabilities to add (e.g., NET_ADMIN, SYS_TIME)
          </p>
        </div>

        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            Comma-separated Linux capabilities to drop (e.g., ALL, NET_RAW)
          </p>
        </div>
      </div>

      {/* Security Options */}
      <div className="space-y-2">
        <label htmlFor="securityOpts" className="text-sm font-medium">
          Security Options
        </label>
        <Input
          id="securityOpts"
          value={formData.securityOpts}
          onChange={(e) => setFormData({ ...formData, securityOpts: e.target.value })}
          placeholder="seccomp=default, apparmor=docker-default"
          disabled={updateProject.isPending}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Comma-separated security options (seccomp, apparmor, no-new-privileges)
        </p>
      </div>

      {/* Namespace Options */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Namespace Options</h3>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="hostPid" className="text-sm font-medium">
              Host PID Namespace
            </label>
            <p className="text-xs text-muted-foreground">Use host process ID namespace</p>
          </div>
          <Switch
            id="hostPid"
            checked={formData.hostPid}
            onCheckedChange={(checked) => setFormData({ ...formData, hostPid: checked })}
            disabled={updateProject.isPending}
          />
        </div>

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="hostNetwork" className="text-sm font-medium">
              Host Network Namespace
            </label>
            <p className="text-xs text-muted-foreground">Use host network namespace</p>
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
