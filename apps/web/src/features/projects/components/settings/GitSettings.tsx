import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface GitSettingsProps {
  project: Project;
}

const HTTPS_PATTERN = /^https:\/\//;
const SSH_PATTERN = /^git@/;

interface FormErrors {
  gitUrl?: string;
  general?: string;
}

export function GitSettings({ project }: GitSettingsProps): React.ReactElement {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const [formData, setFormData] = useState({
    sourceUrl: project.sourceUrl || "",
    branch: (config.branch as string | undefined) || "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateProject = usePatchProject();

  const handleSave = async (): Promise<void> => {
    setErrors({});

    if (formData.sourceUrl) {
      if (!HTTPS_PATTERN.test(formData.sourceUrl) && !SSH_PATTERN.test(formData.sourceUrl)) {
        setErrors({ gitUrl: "Git URL must start with https:// or git@" });
        return;
      }
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            branch: formData.branch || undefined,
          } as Record<string, unknown>,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="sourceUrl" className="text-sm font-medium">
          Git Repository URL
        </label>
        <Input
          id="sourceUrl"
          value={formData.sourceUrl}
          onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
          placeholder="https://github.com/username/repo"
          disabled={updateProject.isPending}
        />
        {errors.gitUrl && <p className="text-sm text-destructive">{errors.gitUrl}</p>}
        <p className="text-xs text-muted-foreground">Use https:// or git@ for SSH URLs</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="branch" className="text-sm font-medium">
          Branch
        </label>
        <Input
          id="branch"
          value={formData.branch}
          onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
          placeholder="main"
          disabled={updateProject.isPending}
        />
        <p className="text-xs text-muted-foreground">Leave empty to use the default branch</p>
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
