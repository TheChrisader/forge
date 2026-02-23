import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface BuildSettingsProps {
  project: Project;
}

interface FormErrors {
  general?: string;
}

export function BuildSettings({ project }: BuildSettingsProps): React.ReactElement {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};

  const [formData, setFormData] = useState({
    buildCommand: (config.buildCommand as string | undefined) || "",
    startCommand: (config.startCommand as string | undefined) || "",
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

  const handleSave = async (): Promise<void> => {
    setErrors({});

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            buildCommand: formData.buildCommand || undefined,
            startCommand: formData.startCommand || undefined,
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  const framework = config.framework as string | undefined;

  return (
    <div className="space-y-4">
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
          disabled={updateProject.isPending}
        >
          {updateProject.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
