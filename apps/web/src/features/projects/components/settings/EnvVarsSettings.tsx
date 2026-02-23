import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PlusIcon, TrashIcon } from "lucide-react";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface EnvVarsSettingsProps {
  project: Project;
}

const ENV_VAR_KEY_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

interface EnvVarDialog {
  isOpen: boolean;
  key: string;
  value: string;
  editMode: boolean;
  editingKey?: string;
}

interface FormErrors {
  general?: string;
  envVarKey?: string;
}

export function EnvVarsSettings({ project }: EnvVarsSettingsProps): React.ReactElement {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const envVars = (config.envVars as Record<string, string> | undefined) || {};

  const [localEnvVars, setLocalEnvVars] = useState<Record<string, string>>(envVars);
  const [dialog, setDialog] = useState<EnvVarDialog>({
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
      value: localEnvVars[key] || "",
      editMode: true,
      editingKey: key,
    });
    setErrors({});
  };

  const handleCloseDialog = (): void => {
    setDialog({ isOpen: false, key: "", value: "", editMode: false });
    setErrors({});
  };

  const handleSaveEnvVar = (): void => {
    setErrors({});

    if (!dialog.key) {
      setErrors({ envVarKey: "Key is required" });
      return;
    }

    if (!ENV_VAR_KEY_PATTERN.test(dialog.key)) {
      setErrors({
        envVarKey:
          "Key must start with a letter or underscore and contain only uppercase letters, numbers, and underscores",
      });
      return;
    }

    if (!dialog.editMode && localEnvVars[dialog.key]) {
      setErrors({ envVarKey: "This key already exists" });
      return;
    }

    const newEnvVars = { ...localEnvVars };
    if (dialog.editMode && dialog.editingKey && dialog.editingKey !== dialog.key) {
      delete newEnvVars[dialog.editingKey];
    }
    newEnvVars[dialog.key] = dialog.value;

    setLocalEnvVars(newEnvVars);
    handleCloseDialog();
  };

  const handleDeleteEnvVar = (key: string): void => {
    const newEnvVars = { ...localEnvVars };
    delete newEnvVars[key];
    setLocalEnvVars(newEnvVars);
  };

  const handleSave = async (): Promise<void> => {
    setErrors({});

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            envVars: localEnvVars,
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  const hasChanges = JSON.stringify(localEnvVars) !== JSON.stringify(envVars);

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {Object.entries(localEnvVars).length === 0 ? (
          <p className="text-sm text-muted-foreground">No environment variables configured</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(localEnvVars).map(([key, value]) => (
              <div key={key} className="flex items-center gap-2">
                <Input value={key} disabled className="flex-1 font-mono" />
                <Input value={value} type="password" disabled className="flex-2 font-mono" />
                <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEditDialog(key)}>
                  ✏️
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteEnvVar(key)}>
                  <TrashIcon />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <Button variant="outline" onClick={handleOpenAddDialog} disabled={updateProject.isPending}>
        <PlusIcon />
        Add Variable
      </Button>

      {dialog.isOpen && (
        <div className="rounded-md border bg-background p-4 shadow-sm">
          <h4 className="mb-4 font-semibold">
            {dialog.editMode ? "Edit Environment Variable" : "Add Environment Variable"}
          </h4>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="env-key" className="text-sm font-medium">
                Key
              </label>
              <Input
                id="env-key"
                value={dialog.key}
                onChange={(e) => setDialog({ ...dialog, key: e.target.value.toUpperCase() })}
                placeholder="API_KEY"
                className="font-mono"
              />
              {errors.envVarKey && <p className="text-sm text-destructive">{errors.envVarKey}</p>}
              <p className="text-xs text-muted-foreground">
                Uppercase letters, numbers, and underscores only
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="env-value" className="text-sm font-medium">
                Value
              </label>
              <Input
                id="env-value"
                value={dialog.value}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                placeholder="secret-value"
                type="password"
                className="font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSaveEnvVar}>{dialog.editMode ? "Update" : "Add"}</Button>
            </div>
          </div>
        </div>
      )}

      {hasChanges && (
        <div className="rounded-md bg-muted p-3">
          <p className="text-sm text-muted-foreground">
            You have unsaved changes. Click "Save Changes" to persist them.
          </p>
        </div>
      )}

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
