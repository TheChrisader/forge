import { JSX, useState } from "react";
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

export function DangerZone({ project }: DangerZoneProps): JSX.Element {
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
      {!showConfirm ? (
        <>
          <p className="text-sm text-muted-foreground">
            Permanently delete this project and all associated data. This action cannot be undone.
          </p>
          <div className="flex justify-end">
            <Button
              variant="destructive"
              onClick={handleDeleteClick}
              disabled={deleteProject.isPending}
            >
              Delete Project
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-sm border border-destructive/40 bg-destructive/5 px-4 py-3">
          <p className="mb-4 text-sm">
            Are you sure you want to delete{" "}
            <span className="font-mono font-semibold">{project.name}</span> this action cannot be
            undone.
          </p>
          {errors.general && (
            <div className="mb-3 rounded-sm bg-destructive/10 px-3 py-2">
              <p className="text-sm text-destructive">{errors.general}</p>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="destructive"
              onClick={() => {
                void handleConfirmDelete();
              }}
              disabled={deleteProject.isPending}
            >
              {deleteProject.isPending ? "Deleting..." : "Confirm Delete"}
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
