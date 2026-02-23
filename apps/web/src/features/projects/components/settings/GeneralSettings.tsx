import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface GeneralSettingsProps {
  project: Project;
}

const NAME_PATTERN = /^[a-z0-9-]+$/;
const MAX_DESCRIPTION_LENGTH = 500;

interface FormErrors {
  name?: string;
  general?: string;
}

export function GeneralSettings({ project }: GeneralSettingsProps): React.ReactElement {
  const metadata = (project.metadata as Record<string, unknown> | null | undefined) || {};
  const [formData, setFormData] = useState({
    name: project.name,
    description: (metadata.description as string | undefined) || "",
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const updateProject = usePatchProject();

  const handleSave = async (): Promise<void> => {
    setErrors({});

    if (!formData.name) {
      setErrors({ name: "Project name is required" });
      return;
    }

    if (!NAME_PATTERN.test(formData.name)) {
      setErrors({ name: "Name must contain only lowercase letters, numbers, and hyphens" });
      return;
    }

    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          name: formData.name,
          metadata: formData.description ? { description: formData.description } : undefined,
        },
      });
    } catch (err) {
      const error = err as ApiClientError;

      if (error.code === "CONFLICT") {
        setErrors({ name: "A project with this name already exists" });
      } else {
        setErrors({ general: error.message || "Failed to save settings" });
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label htmlFor="name" className="text-sm font-medium">
          Project Name
        </label>
        <Input
          id="name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          disabled={updateProject.isPending}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers, and hyphens only
        </p>
      </div>

      <div className="space-y-2">
        <label htmlFor="description" className="text-sm font-medium">
          Description
        </label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) =>
            setFormData({
              ...formData,
              description: e.target.value.slice(0, MAX_DESCRIPTION_LENGTH),
            })
          }
          rows={3}
          disabled={updateProject.isPending}
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        <p className="text-xs text-muted-foreground">
          {formData.description.length}/{MAX_DESCRIPTION_LENGTH} characters
        </p>
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
