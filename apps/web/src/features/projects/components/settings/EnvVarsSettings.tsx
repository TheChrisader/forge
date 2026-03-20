import { JSX, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
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

export function EnvVarsSettings({ project }: EnvVarsSettingsProps): JSX.Element {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const runtimeConfig = (config.runtime as Record<string, unknown> | undefined) || {};
  const envVars = (runtimeConfig.env as Record<string, string> | undefined) || {};

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
            runtime: {
              ...(typeof runtimeConfig === "object" ? runtimeConfig : {}),
              env: localEnvVars,
            },
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
      {/* Environment Variables List */}
      {Object.entries(localEnvVars).length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/40 rounded-sm">
          <p className="text-sm text-muted-foreground">No environment variables configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
            Add variables to configure your application
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {Object.entries(localEnvVars).map(([key, value]) => (
            <div
              key={key}
              className="flex items-center gap-2 p-2.5 border border-border/40 rounded-sm bg-muted/10 group"
            >
              <div className="flex-1 font-mono text-sm">{key}</div>
              <div className="flex-2 font-mono text-sm text-muted-foreground">
                {"*".repeat(Math.min(value.length, 20))}
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
                onClick={() => handleDeleteEnvVar(key)}
                className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <Button variant="outline" onClick={handleOpenAddDialog} disabled={updateProject.isPending}>
        <PlusIcon className="h-4 w-4 mr-1.5" />
        Add Variable
      </Button>

      {/* Dialog */}
      {dialog.isOpen && (
        <div className="border border-border/60 rounded-sm bg-background p-4 shadow-sm">
          <h4 className="mb-4 font-semibold text-sm">
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
              <p className="text-xs text-muted-foreground font-mono">
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

      {/* Unsaved Changes Warning */}
      {hasChanges && !dialog.isOpen && (
        <div className="rounded-sm border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-sm text-amber-200">
            You have unsaved changes. Click "Save Changes" to persist them.
          </p>
        </div>
      )}

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
