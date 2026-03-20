import { JSX, useState } from "react";
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

export function RuntimeSettings({ project }: RuntimeSettingsProps): JSX.Element {
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

  const hasChanges =
    formData.port !== ((runtimeConfig.port as number | undefined) ?? "") ||
    formData.command !== arrayToString(runtimeConfig.command as string | string[] | undefined) ||
    formData.entrypoint !== arrayToString(runtimeConfig.entrypoint as string[] | undefined) ||
    formData.workingDir !== (runtimeConfig.workingDir as string | undefined) ||
    formData.user !== (runtimeConfig.user as string | undefined) ||
    formData.nodeVersion !== (runtimeConfig.nodeVersion as string | undefined) ||
    formData.pythonVersion !== (runtimeConfig.pythonVersion as string | undefined) ||
    formData.goVersion !== (runtimeConfig.goVersion as string | undefined);

  return (
    <div className="space-y-5">
      {/* Port */}
      <div className="gap-2 flex flex-col">
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
          className="max-w-xs font-mono"
        />
        {errors.port && <p className="text-sm text-destructive">{errors.port}</p>}
        <p className="text-xs text-muted-foreground font-mono">Main container port (1-65535)</p>
      </div>

      <div className="border-t border-border/40" />

      {/* Command & Entrypoint */}
      <div className="grid grid-cols-2 gap-4">
        <div className="gap-2 flex flex-col">
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
          <p className="text-xs text-muted-foreground font-mono">Override default command</p>
        </div>

        <div className="gap-2 flex flex-col">
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
          <p className="text-xs text-muted-foreground font-mono">Comma-separated values</p>
        </div>
      </div>

      {/* Working Dir & User */}
      <div className="grid grid-cols-2 gap-4">
        <div className="gap-2 flex flex-col">
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
        </div>

        <div className="gap-2 flex flex-col">
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
        </div>
      </div>

      <div className="border-t border-border/40" />

      {/* Runtime Versions */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Runtime Versions
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="gap-2 flex flex-col">
            <label htmlFor="nodeVersion" className="text-sm font-medium">
              Node.js
            </label>
            <Input
              id="nodeVersion"
              value={formData.nodeVersion}
              onChange={(e) => setFormData({ ...formData, nodeVersion: e.target.value })}
              placeholder="20"
              disabled={updateProject.isPending}
              className="font-mono"
            />
          </div>

          <div className="gap-2 flex flex-col">
            <label htmlFor="pythonVersion" className="text-sm font-medium">
              Python
            </label>
            <Input
              id="pythonVersion"
              value={formData.pythonVersion}
              onChange={(e) => setFormData({ ...formData, pythonVersion: e.target.value })}
              placeholder="3.11"
              disabled={updateProject.isPending}
              className="font-mono"
            />
          </div>

          <div className="gap-2 flex flex-col">
            <label htmlFor="goVersion" className="text-sm font-medium">
              Go
            </label>
            <Input
              id="goVersion"
              value={formData.goVersion}
              onChange={(e) => setFormData({ ...formData, goVersion: e.target.value })}
              placeholder="1.21"
              disabled={updateProject.isPending}
              className="font-mono"
            />
          </div>
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

function arrayToString(value: string | string[] | undefined): string {
  if (value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  return value;
}

function stringToArray(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
