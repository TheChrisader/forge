import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { PlusIcon, TrashIcon } from "lucide-react";
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

export function BuildSettings({ project }: BuildSettingsProps): React.ReactElement {
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
      <div className="space-y-2">
        <label className="text-sm font-medium">Framework</label>
        <div className="flex items-center gap-2">
          <Input value={framework || "Not detected"} disabled className="max-w-xs" />
          {framework && <Badge variant="secondary">Auto-detected</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">
          Framework is automatically detected from your repository
        </p>
      </div>

      {/* Docker Build Settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Docker Build</h3>

        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            Path to Dockerfile relative to project root
          </p>
        </div>

        <div className="space-y-2">
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
          <p className="text-xs text-muted-foreground">
            Build context directory (default: project root)
          </p>
        </div>

        {/* Build Args */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Build Arguments</label>
          {Object.entries(localBuildArgs).length === 0 ? (
            <p className="text-sm text-muted-foreground">No build arguments configured</p>
          ) : (
            <div className="space-y-2">
              {Object.entries(localBuildArgs).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <Input value={key} disabled className="flex-1 font-mono text-sm" />
                  <Input value={value} disabled className="flex-2 font-mono text-sm" />
                  <Button variant="ghost" size="icon-sm" onClick={() => handleOpenEditDialog(key)}>
                    ✏️
                  </Button>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDeleteBuildArg(key)}>
                    <TrashIcon />
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
            <PlusIcon />
            Add Build Arg
          </Button>

          {dialog.isOpen && (
            <div className="rounded-md border bg-background p-4 shadow-sm">
              <h4 className="mb-4 font-semibold">
                {dialog.editMode ? "Edit Build Argument" : "Add Build Argument"}
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
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
                <div className="space-y-2">
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

      {/* Framework Build Settings */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium">Framework Build</h3>

        <div className="space-y-2">
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
              <Badge variant="secondary">Auto-detected</Badge>
            )}
            {modifiedFields.has("installCommand") && <Badge variant="outline">Custom</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Command to install dependencies</p>
        </div>

        <div className="space-y-2">
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
              <Badge variant="secondary">Auto-detected</Badge>
            )}
            {modifiedFields.has("buildCommand") && <Badge variant="outline">Custom</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">Command to build your application</p>
        </div>
      </div>

      {/* Start Command */}
      <div className="space-y-2">
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
            <Badge variant="secondary">Auto-detected</Badge>
          )}
          {modifiedFields.has("startCommand") && <Badge variant="outline">Custom</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">Command to start your application</p>
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
