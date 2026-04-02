import { JSX, useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PlusIcon, TrashIcon, PencilIcon, EyeIcon } from "lucide-react";
import {
  useSecrets,
  useCreateSecret,
  useUpdateSecret,
  useDeleteSecret,
} from "@/core/api/hooks/useSecrets";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface SecretsSettingsProps {
  project: Project;
}

interface SecretDialog {
  isOpen: boolean;
  key: string;
  value: string;
  description: string;
  editMode: boolean;
  editingId?: string;
}

interface FormErrors {
  general?: string;
  key?: string;
  value?: string;
}

function formatRelativeTime(date: string | null): string {
  if (!date) return "Never";
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export function SecretsSettings({ project }: SecretsSettingsProps): JSX.Element {
  const { data: secrets = [], isLoading } = useSecrets(project.id);
  const createMutation = useCreateSecret();
  const updateMutation = useUpdateSecret();
  const deleteMutation = useDeleteSecret();

  const [dialog, setDialog] = useState<SecretDialog>({
    isOpen: false,
    key: "",
    value: "",
    description: "",
    editMode: false,
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleOpenAddDialog = (): void => {
    setDialog({ isOpen: true, key: "", value: "", description: "", editMode: false });
    setErrors({});
  };

  const handleOpenEditDialog = (id: string, key: string): void => {
    setDialog({
      isOpen: true,
      key,
      value: "",
      description: "",
      editMode: true,
      editingId: id,
    });
    setErrors({});
  };

  const handleCloseDialog = (): void => {
    setDialog({ isOpen: false, key: "", value: "", description: "", editMode: false });
    setErrors({});
  };

  const handleSaveSecret = async (): Promise<void> => {
    setErrors({});

    if (!dialog.key.trim()) {
      setErrors({ key: "Key is required" });
      return;
    }

    if (!dialog.editMode && !dialog.value) {
      setErrors({ value: "Value is required" });
      return;
    }

    if (dialog.editMode && !dialog.editingId) {
      setErrors({ general: "Invalid secret ID" });
      return;
    }

    try {
      if (dialog.editMode && dialog.editingId) {
        if (!dialog.value) {
          setErrors({ value: "Value is required" });
          return;
        }
        await updateMutation.mutateAsync({
          projectId: project.id,
          id: dialog.editingId,
          data: { value: dialog.value },
        });
      } else {
        await createMutation.mutateAsync({
          projectId: project.id,
          data: {
            key: dialog.key,
            value: dialog.value,
            description: dialog.description || undefined,
          },
        });
      }
      handleCloseDialog();
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to save secret" });
    }
  };

  const handleDelete = async (id: string): Promise<void> => {
    try {
      await deleteMutation.mutateAsync({ projectId: project.id, id });
      setConfirmDeleteId(null);
    } catch (err) {
      const error = err as ApiClientError;
      setErrors({ general: error.message || "Failed to delete secret" });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">Loading secrets...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Secrets List */}
      {secrets.length === 0 ? (
        <div className="text-center py-8 border border-dashed border-border/40 rounded-sm">
          <p className="text-sm text-muted-foreground">No secrets configured</p>
          <p className="text-xs text-muted-foreground/60 mt-1 font-mono">
            Add secrets to store sensitive values securely
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {secrets.map((secret) => (
            <div
              key={secret.id}
              className="p-3 border border-border/40 rounded-sm bg-muted/10 group"
            >
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <EyeIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="font-mono text-sm font-medium truncate">{secret.key}</span>
                </div>

                {secret.description && (
                  <span className="text-xs text-muted-foreground truncate max-w-48">
                    {secret.description}
                  </span>
                )}

                <div className="flex items-center gap-3 text-xs text-muted-foreground/60 shrink-0">
                  <span className="font-mono">
                    {secret.accessCount === 0 ? "unused" : `${secret.accessCount}x accessed`}
                  </span>
                  <span className="font-mono">{formatRelativeTime(secret.lastAccessedAt)}</span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => handleOpenEditDialog(secret.id, secret.key)}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                  {confirmDeleteId === secret.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          void handleDelete(secret.id);
                        }}
                        className="text-destructive hover:text-destructive"
                        disabled={deleteMutation.isPending}
                      >
                        Confirm
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirmDeleteId(secret.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Button */}
      <Button variant="outline" onClick={handleOpenAddDialog}>
        <PlusIcon className="h-4 w-4 mr-1.5" />
        Add Secret
      </Button>

      {/* Dialog */}
      {dialog.isOpen && (
        <div className="border border-border/60 rounded-sm bg-background p-4 shadow-sm">
          <h4 className="mb-4 font-semibold text-sm">
            {dialog.editMode ? `Update Secret: ${dialog.key}` : "Add Secret"}
          </h4>

          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="secret-key" className="text-sm font-medium">
                Key
              </label>
              <Input
                id="secret-key"
                value={dialog.key}
                onChange={(e) => setDialog({ ...dialog, key: e.target.value })}
                placeholder="DATABASE_URL"
                className="font-mono"
                disabled={dialog.editMode}
              />
              {errors.key && <p className="text-sm text-destructive">{errors.key}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor="secret-value" className="text-sm font-medium">
                {dialog.editMode ? "New Value" : "Value"}
              </label>
              <Input
                id="secret-value"
                value={dialog.value}
                onChange={(e) => setDialog({ ...dialog, value: e.target.value })}
                placeholder="secret-value"
                type="password"
                className="font-mono"
              />
              {errors.value && <p className="text-sm text-destructive">{errors.value}</p>}
            </div>

            {!dialog.editMode && (
              <div className="space-y-2">
                <label htmlFor="secret-description" className="text-sm font-medium">
                  Description <span className="text-muted-foreground font-normal">(optional)</span>
                </label>
                <Input
                  id="secret-description"
                  value={dialog.description}
                  onChange={(e) => setDialog({ ...dialog, description: e.target.value })}
                  placeholder="Database connection string"
                />
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  void handleSaveSecret();
                }}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving..."
                  : dialog.editMode
                    ? "Update"
                    : "Add"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {errors.general && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2">
          <p className="text-sm text-destructive">{errors.general}</p>
        </div>
      )}
    </div>
  );
}
