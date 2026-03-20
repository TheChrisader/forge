import { useState, useEffect, JSX } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project, ProjectSourceType } from "@forge/types";

interface SourceSettingsProps {
  project: Project;
}

const HTTPS_PATTERN = /^https:\/\//;
const SSH_PATTERN = /^git@/;
const IMAGE_PATTERN =
  /^[a-z0-9][a-z0-9._-]*[a-z0-9](\/[a-z0-9][a-z0-9._-]*[a-z0-9])?(:[\w][\w.-]*)?$/i;
const LOCAL_PATH_PATTERN = /^(\/[\w.~-]+)+|^[a-zA-Z]:\\(?:[\w.~-]+\\?)*$/;

interface FormErrors {
  sourceUrl?: string;
  general?: string;
}

export function SourceSettings({ project }: SourceSettingsProps): JSX.Element {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const buildConfig = (config.build as Record<string, unknown> | undefined) || {};

  const currentSourceType = (project.sourceType || "git") as "git" | "local" | "image";

  const [formData, setFormData] = useState({
    sourceType: currentSourceType,
    sourceUrl: project.sourceUrl || "",
    branch: (buildConfig.branch as string | undefined) || "",
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [sourceTypeChanged, setSourceTypeChanged] = useState(false);

  const updateProject = usePatchProject();

  useEffect(() => {
    if (formData.sourceType !== currentSourceType) {
      setFormData((prev) => ({ ...prev, sourceUrl: "" }));
      setSourceTypeChanged(true);
    }
  }, [formData.sourceType, currentSourceType]);

  const handleSave = async (): Promise<void> => {
    setErrors({});

    if (formData.sourceUrl) {
      if (formData.sourceType === "git") {
        if (!HTTPS_PATTERN.test(formData.sourceUrl) && !SSH_PATTERN.test(formData.sourceUrl)) {
          setErrors({ sourceUrl: "Git URL must start with https:// or git@" });
          return;
        }
      } else if (formData.sourceType === "local") {
        if (!LOCAL_PATH_PATTERN.test(formData.sourceUrl)) {
          setErrors({ sourceUrl: "Invalid local path format" });
          return;
        }
      } else if (formData.sourceType === "image") {
        if (!IMAGE_PATTERN.test(formData.sourceUrl)) {
          setErrors({ sourceUrl: "Invalid image format. Use registry/image:tag" });
          return;
        }
      }
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          sourceType: formData.sourceType as ProjectSourceType,
          sourceUrl: sourceTypeChanged || formData.sourceUrl ? formData.sourceUrl || "" : undefined,
          config: {
            ...(typeof config === "object" ? config : {}),
            build: {
              ...(typeof buildConfig === "object" ? buildConfig : {}),
              branch: formData.sourceType === "git" ? formData.branch || undefined : undefined,
            },
          } as Record<string, unknown>,
        },
      });
      setSourceTypeChanged(false);
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save settings" });
    }
  };

  const hasChanges =
    formData.sourceType !== currentSourceType ||
    formData.sourceUrl !== project.sourceUrl ||
    formData.branch !== (buildConfig.branch as string | undefined);

  return (
    <div className="space-y-5">
      {/* Source Type */}
      <div className="gap-2 flex flex-col">
        <label htmlFor="sourceType" className="text-sm font-medium text-foreground">
          Source Type
        </label>
        <Select
          value={formData.sourceType}
          onValueChange={(value) =>
            setFormData({ ...formData, sourceType: value as "git" | "local" | "image" })
          }
          disabled={updateProject.isPending}
        >
          <SelectTrigger id="sourceType" className="max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="git">Git Repository</SelectItem>
            <SelectItem value="local">Local Path</SelectItem>
            <SelectItem value="image">Docker Registry</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Source URL */}
      <div className="gap-2 flex flex-col">
        <label htmlFor="sourceUrl" className="text-sm font-medium text-foreground">
          {formData.sourceType === "git" && "Repository URL"}
          {formData.sourceType === "local" && "Local Path"}
          {formData.sourceType === "image" && "Image Reference"}
        </label>
        <Input
          id="sourceUrl"
          value={formData.sourceUrl}
          onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
          placeholder={
            formData.sourceType === "git"
              ? "https://github.com/username/repo"
              : formData.sourceType === "local"
                ? "/path/to/project"
                : "registry.example.com/image:tag"
          }
          disabled={updateProject.isPending}
          className="font-mono max-w-md"
        />
        {errors.sourceUrl && <p className="text-sm text-destructive">{errors.sourceUrl}</p>}
        <p className="text-xs text-muted-foreground font-mono">
          {formData.sourceType === "git" && "https:// or git@ for SSH URLs"}
          {formData.sourceType === "local" && "Absolute path to project directory"}
          {formData.sourceType === "image" && "Docker image with registry and tag"}
        </p>
      </div>

      {/* Branch (Git only) */}
      {formData.sourceType === "git" && (
        <div className="gap-2 flex flex-col">
          <label htmlFor="branch" className="text-sm font-medium text-foreground">
            Branch
          </label>
          <Input
            id="branch"
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
            placeholder="main"
            disabled={updateProject.isPending}
            className="font-mono max-w-md"
          />
          <p className="text-xs text-muted-foreground font-mono">
            Leave empty to use the default branch
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
