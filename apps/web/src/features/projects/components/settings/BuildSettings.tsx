import { JSX, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { PlusIcon, TrashIcon, PencilIcon } from "lucide-react";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface BuildSettingsProps {
  project: Project;
}

interface BuildArgDialog {
  isOpen: boolean;
  key: string;
  value: string;
  editMode: boolean;
  editingKey?: string;
}

interface FormErrors {
  general?: string;
  buildArgKey?: string;
}

export function BuildSettings({ project }: BuildSettingsProps): JSX.Element {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const buildConfig = (config.build as Record<string, unknown> | undefined) || {};
  const runtimeConfig = (config.runtime as Record<string, unknown> | undefined) || {};

  const buildArgs = (buildConfig.buildArgs as Record<string, string> | undefined) || {};

  const [formData, setFormData] = useState({
    dockerfile: (buildConfig.dockerfile as string | undefined) || "",
    context: (buildConfig.context as string | undefined) || "",
    buildCommand: (buildConfig.buildCommand as string | undefined) || "",
    installCommand: (buildConfig.installCommand as string | undefined) || "",
    startCommand: (runtimeConfig.startCommand as string | undefined) || "",
  });
  const [localBuildArgs, setLocalBuildArgs] = useState<Record<string, string>>(buildArgs);
  const [dialog, setDialog] = useState<BuildArgDialog>({
    isOpen: false,
    key: "",
    value: "",
    editMode: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [modifiedFields, setModifiedFields] = useState<Set<string>>(new Set());

  const updateProject = usePatchProject();

  const isAutoDetected = (field: keyof typeof formData): boolean => {
    return Boolean(formData[field] && !modifiedFields.has(field));
  };

  const handleFieldChange = (field: keyof typeof formData, value: string): void => {
    setFormData({ ...formData, [field]: value });
    if (value) {
      setModifiedFields((prev) => new Set(prev).add(field));
    }
  };

  const handleOpenAddDialog = (): void => {
    setDialog({ isOpen: true, key: "", value: "", editMode: false });
    setErrors({});
  };

  const handleOpenEditDialog = (key: string): void => {
    setDialog({
      isOpen: true,
      key,
      value: localBuildArgs[key] || "",
      editMode: true,
      editingKey: key,
    });
    setErrors({});
  };

  const handleCloseDialog = (): void => {
    setDialog({ isOpen: false, key: "", value: "", editMode: false });
    setErrors({});
  };

  const handleSaveBuildArg = (): void => {
    setErrors({});

    if (!dialog.key) {
      setErrors({ buildArgKey: "Key is required" });
      return;
    }

    if (!dialog.editMode && localBuildArgs[dialog.key]) {
      setErrors({ buildArgKey: "This key already exists" });
      return;
    }

    const newBuildArgs = { ...localBuildArgs };
    if (dialog.editMode && dialog.editingKey && dialog.editingKey !== dialog.key) {
      delete newBuildArgs[dialog.editingKey];
    }
    newBuildArgs[dialog.key] = dialog.value;

    setLocalBuildArgs(newBuildArgs);
    handleCloseDialog();
  };

  const handleDeleteBuildArg = (key: string): void => {
    const newBuildArgs = { ...localBuildArgs };
    delete newBuildArgs[key];
    setLocalBuildArgs(newBuildArgs);
  };

  const handleSave = async (): Promise<void> => {
    setErrors({});

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            build: {
              ...(typeof buildConfig === "object" ? buildConfig : {}),
              dockerfile: formData.dockerfile || undefined,
              context: formData.context || undefined,
              buildArgs: Object.keys(localBuildArgs).length > 0 ? localBuildArgs : undefined,
              buildCommand: formData.buildCommand || undefined,
              installCommand: formData.installCommand || undefined,
            },
            runtime: {
              ...(typeof runtimeConfig === "object" ? runtimeConfig : {}),
              startCommand: formData.startCommand || undefined,
            },
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  const framework = buildConfig.framework as string | undefined;

  const hasChanges =
    JSON.stringify(formData) !==
      JSON.stringify({
        dockerfile: (buildConfig.dockerfile as string | undefined) || "",
        context: (buildConfig.context as string | undefined) || "",
        buildCommand: (buildConfig.buildCommand as string | undefined) || "",
        installCommand: (buildConfig.installCommand as string | undefined) || "",
        startCommand: (runtimeConfig.startCommand as string | undefined) || "",
      }) || JSON.stringify(localBuildArgs) !== JSON.stringify(buildArgs);

  return (
    <div className="space-y-6">
      {/* Framework Detection */}
      <div className="flex items-center gap-3">
        <div className="text-sm text-muted-foreground">Framework</div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{framework || "Not detected"}</span>
          {framework && (
            <Badge variant="secondary" className="text-xs">
              Auto-detected
            </Badge>
          )}
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Docker Build Settings */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Docker Build
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="gap-2 flex flex-col">
            <label htmlFor="dockerfile" className="text-sm font-medium">
              Dockerfile Path
            </label>
            <Input
              id="dockerfile"
              value={formData.dockerfile}
              onChange={(e) => handleFieldChange("dockerfile", e.target.value)}
              placeholder="Dockerfile"
              disabled={updateProject.isPending}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">Relative to project root</p>
          </div>

          <div className="gap-2 flex flex-col">
            <label htmlFor="context" className="text-sm font-medium">
              Build Context
            </label>
            <Input
              id="context"
              value={formData.context}
              onChange={(e) => handleFieldChange("context", e.target.value)}
              placeholder="."
              disabled={updateProject.isPending}
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">Default: project root</p>
          </div>
        </div>

        {/* Build Args */}
        <div className="gap-2 flex flex-col">
          <div className="text-sm font-medium">Build Arguments</div>
          {Object.entries(localBuildArgs).length === 0 ? (
            <p className="text-sm text-muted-foreground">No build arguments configured</p>
          ) : (
            <div className="gap-2 flex flex-col">
              {Object.entries(localBuildArgs).map(([key, value]) => (
                <div
                  key={key}
                  className="flex items-center gap-2 p-2 border border-border/40 rounded-sm bg-muted/10 group"
                >
                  <div className="flex-1 font-mono text-sm">{key}</div>
                  <div className="flex-2 font-mono text-sm text-muted-foreground">{value}</div>
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
                    onClick={() => handleDeleteBuildArg(key)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <Button
            variant="outline"
            onClick={handleOpenAddDialog}
            disabled={updateProject.isPending}
          >
            <PlusIcon className="h-4 w-4 mr-1.5" />
            Add Build Arg
          </Button>

          {dialog.isOpen && (
            <div className="border border-border/60 rounded-sm bg-background p-4 shadow-sm">
              <h4 className="mb-4 font-semibold text-sm">
                {dialog.editMode ? "Edit Build Argument" : "Add Build Argument"}
              </h4>
              <div className="space-y-4">
                <div className="gap-2 flex flex-col">
                  <label htmlFor="arg-key" className="text-sm font-medium">
                    Key
                  </label>
                  <Input
                    id="arg-key"
                    value={dialog.key}
                    onChange={(e) => setDialog({ ...dialog, key: e.target.value })}
                    placeholder="NODE_ENV"
                    className="font-mono"
                  />
                  {errors.buildArgKey && (
                    <p className="text-sm text-destructive">{errors.buildArgKey}</p>
                  )}
                </div>
                <div className="gap-2 flex flex-col">
                  <label htmlFor="arg-value" className="text-sm font-medium">
                    Value
                  </label>
                  <Input
                    id="arg-value"
                    value={dialog.value}
                    onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                    placeholder="production"
                    className="font-mono"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveBuildArg}>{dialog.editMode ? "Update" : "Add"}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Framework Build Settings */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Framework Build
        </div>

        <div className="gap-2 flex flex-col">
          <label htmlFor="installCommand" className="text-sm font-medium">
            Install Command
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="installCommand"
              value={formData.installCommand}
              onChange={(e) => handleFieldChange("installCommand", e.target.value)}
              placeholder="npm install"
              disabled={updateProject.isPending}
            />
            {isAutoDetected("installCommand") && !modifiedFields.has("installCommand") && (
              <Badge variant="secondary" className="text-xs">
                Auto-detected
              </Badge>
            )}
            {modifiedFields.has("installCommand") && (
              <Badge variant="outline" className="text-xs">
                Custom
              </Badge>
            )}
          </div>
        </div>

        <div className="gap-2 flex flex-col">
          <label htmlFor="buildCommand" className="text-sm font-medium">
            Build Command
          </label>
          <div className="flex items-center gap-2">
            <Input
              id="buildCommand"
              value={formData.buildCommand}
              onChange={(e) => handleFieldChange("buildCommand", e.target.value)}
              placeholder="npm run build"
              disabled={updateProject.isPending}
            />
            {isAutoDetected("buildCommand") && !modifiedFields.has("buildCommand") && (
              <Badge variant="secondary" className="text-xs">
                Auto-detected
              </Badge>
            )}
            {modifiedFields.has("buildCommand") && (
              <Badge variant="outline" className="text-xs">
                Custom
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Start Command */}
      <div className="gap-2 flex flex-col">
        <label htmlFor="startCommand" className="text-sm font-medium">
          Start Command
        </label>
        <div className="flex items-center gap-2">
          <Input
            id="startCommand"
            value={formData.startCommand}
            onChange={(e) => handleFieldChange("startCommand", e.target.value)}
            placeholder="npm start"
            disabled={updateProject.isPending}
          />
          {isAutoDetected("startCommand") && !modifiedFields.has("startCommand") && (
            <Badge variant="secondary" className="text-xs">
              Auto-detected
            </Badge>
          )}
          {modifiedFields.has("startCommand") && (
            <Badge variant="outline" className="text-xs">
              Custom
            </Badge>
          )}
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
