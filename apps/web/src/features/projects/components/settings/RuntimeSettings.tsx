import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface RuntimeSettingsProps {
  project: Project;
}

interface FormErrors {
  port?: string;
  general?: string;
}

export function RuntimeSettings({ project }: RuntimeSettingsProps): React.ReactElement {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const runtimeConfig = (config.runtime as Record<string, unknown> | undefined) || {};

  const [formData, setFormData] = useState({
    port: (runtimeConfig.port as number | undefined) ?? "",
    command: arrayToString(runtimeConfig.command as string | string[] | undefined),
    entrypoint: arrayToString(runtimeConfig.entrypoint as string[] | undefined),
    workingDir: (runtimeConfig.workingDir as string | undefined) || "",
    user: (runtimeConfig.user as string | undefined) || "",
    nodeVersion: (runtimeConfig.nodeVersion as string | undefined) || "",
    pythonVersion: (runtimeConfig.pythonVersion as string | undefined) || "",
    goVersion: (runtimeConfig.goVersion as string | undefined) || "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateProject = usePatchProject();

  const handleSave = async (): Promise<void> => {
    setErrors({});

    if (formData.port) {
      const portNum = Number(formData.port);
      if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
        setErrors({ port: "Port must be between 1 and 65535" });
        return;
      }
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            runtime: {
              ...(typeof runtimeConfig === "object" ? runtimeConfig : {}),
              port: formData.port ? Number(formData.port) : undefined,
              command: formData.command ? stringToArray(formData.command) : undefined,
              entrypoint: formData.entrypoint ? stringToArray(formData.entrypoint) : undefined,
              workingDir: formData.workingDir || undefined,
              user: formData.user || undefined,
              nodeVersion: formData.nodeVersion || undefined,
              pythonVersion: formData.pythonVersion || undefined,
              goVersion: formData.goVersion || undefined,
            },
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label htmlFor="port" className="text-sm font-medium">
          Port
        </label>
        <Input
          id="port"
          type="number"
          min="1"
          max="65535"
          value={formData.port}
          onChange={(e) => setFormData({ ...formData, port: e.target.value })}
          placeholder="3000"
          disabled={updateProject.isPending}
        />
        {errors.port && <p className="text-sm text-destructive">{errors.port}</p>}
        <p className="text-xs text-muted-foreground">
          Main container port (1-65535). Leave empty to use framework default.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="command" className="text-sm font-medium">
          Command
        </label>
        <Input
          id="command"
          value={formData.command}
          onChange={(e) => setFormData({ ...formData, command: e.target.value })}
          placeholder="npm start"
          disabled={updateProject.isPending}
        />
        <p className="text-xs text-muted-foreground">
          Override the default container command. Use comma-separated values for arrays (e.g.,
          &quot;npm, start&quot;)
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="entrypoint" className="text-sm font-medium">
          Entrypoint
        </label>
        <Input
          id="entrypoint"
          value={formData.entrypoint}
          onChange={(e) => setFormData({ ...formData, entrypoint: e.target.value })}
          placeholder="/bin/sh, -c"
          disabled={updateProject.isPending}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Override the default entrypoint. Comma-separated values (e.g., &quot;/bin/sh, -c&quot;)
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="workingDir" className="text-sm font-medium">
          Working Directory
        </label>
        <Input
          id="workingDir"
          value={formData.workingDir}
          onChange={(e) => setFormData({ ...formData, workingDir: e.target.value })}
          placeholder="/app"
          disabled={updateProject.isPending}
          className="font-mono"
        />
        <p className="text-xs text-muted-foreground">
          Working directory inside the container. Leave empty for image default.
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="user" className="text-sm font-medium">
          User
        </label>
        <Input
          id="user"
          value={formData.user}
          onChange={(e) => setFormData({ ...formData, user: e.target.value })}
          placeholder="node"
          disabled={updateProject.isPending}
        />
        <p className="text-xs text-muted-foreground">
          User to run the container as (uid or username). Leave empty for image default.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label htmlFor="nodeVersion" className="text-sm font-medium">
            Node.js Version
          </label>
          <Input
            id="nodeVersion"
            value={formData.nodeVersion}
            onChange={(e) => setFormData({ ...formData, nodeVersion: e.target.value })}
            placeholder="20"
            disabled={updateProject.isPending}
          />
          <p className="text-xs text-muted-foreground">e.g., 20, 18, lts</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="pythonVersion" className="text-sm font-medium">
            Python Version
          </label>
          <Input
            id="pythonVersion"
            value={formData.pythonVersion}
            onChange={(e) => setFormData({ ...formData, pythonVersion: e.target.value })}
            placeholder="3.11"
            disabled={updateProject.isPending}
          />
          <p className="text-xs text-muted-foreground">e.g., 3.11, 3.12</p>
        </div>

        <div className="space-y-2">
          <label htmlFor="goVersion" className="text-sm font-medium">
            Go Version
          </label>
          <Input
            id="goVersion"
            value={formData.goVersion}
            onChange={(e) => setFormData({ ...formData, goVersion: e.target.value })}
            placeholder="1.21"
            disabled={updateProject.isPending}
          />
          <p className="text-xs text-muted-foreground">e.g., 1.21, 1.22</p>
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
          disabled={updateProject.isPending}
        >
          {updateProject.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

/**
 * Convert array to comma-separated string for display
 */
function arrayToString(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

/**
 * Convert comma-separated string to array for storage
 */
function stringToArray(value: string): string[] {
  if (!value.trim()) return [];
  // Split by comma and trim each part
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
