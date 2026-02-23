import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button } from "@/shared/components/ui/button";
import { useDeleteProject } from "@/core/api/hooks/useProjects";
import { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface DangerZoneProps {
  project: Project;
}

interface FormErrors {
  general?: string;
}

export function DangerZone({ project }: DangerZoneProps): React.ReactElement {
  const router = useRouter();
  const [errors, setErrors] = useState<FormErrors>({});
  const [showConfirm, setShowConfirm] = useState(false);

  const deleteProject = useDeleteProject();

  const handleDeleteClick = (): void => {
    setShowConfirm(true);
  };

  const handleCancelDelete = (): void => {
    setShowConfirm(false);
    setErrors({});
  };

  const handleConfirmDelete = async (): Promise<void> => {
    setErrors({});

    try {
      await deleteProject.mutateAsync(project.id);
      await router.navigate({ to: "/projects" });
    } catch (err) {
      const error = err as ApiClientError;

      if (error.code === "CONFLICT") {
        setErrors({
          general:
            "Cannot delete project with an active deployment. Please stop all deployments first.",
        });
      } else {
        setErrors({ general: error.message || "Failed to delete project" });
      }
      setShowConfirm(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Once you delete a project, there is no going back. Please be certain.
      </p>

      {errors.general && (
        <div className="rounded-md bg-destructive/10 p-3">
          <p className="text-sm text-destructive">{errors.general}</p>
        </div>
      )}

      {!showConfirm ? (
        <Button
          variant="destructive"
          onClick={handleDeleteClick}
          disabled={deleteProject.isPending}
        >
          Delete Project
        </Button>
      ) : (
        <div className="rounded-md border border-destructive/50 bg-destructive/5 p-4">
          <p className="mb-4 text-sm">
            Are you sure you want to delete <strong>{project.name}</strong>? This action cannot be
            undone.
          </p>
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                void handleConfirmDelete();
              }}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Yes, delete project"}
            </Button>
            <Button
              variant="outline"
              onClick={handleCancelDelete}
              disabled={deleteProject.isPending}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
