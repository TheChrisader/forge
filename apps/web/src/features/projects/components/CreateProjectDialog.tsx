import { useState, useCallback, useEffect } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCreateProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { ProjectSourceType } from "@forge/types";

interface CreateProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormData {
  name: string;
  sourceType: "git" | "local" | "image" | "";
  sourceUrl: string;
  description: string;
}

interface FormErrors {
  name?: string;
  sourceUrl?: string;
  general?: string;
}

const NAME_PATTERN = /^[a-z0-9-]+$/;
const MAX_NAME_LENGTH = 64;
const MAX_DESCRIPTION_LENGTH = 500;

// Simplified patterns for UX validation (backend uses stricter patterns)
const HTTPS_PATTERN = /^https:\/\//;
const SSH_PATTERN = /^git@/;
const IMAGE_PATTERN =
  /^[a-z0-9][a-z0-9._-]*[a-z0-9](\/[a-z0-9][a-z0-9._-]*[a-z0-9])?(:[\w][\w.-]*)?$/i;
const LOCAL_PATH_PATTERN = /^(\/[\w.~-]+)+|^[a-zA-Z]:\\(?:[\w.~-]+\\?)*$/;

export function CreateProjectDialog({
  isOpen,
  onClose,
}: CreateProjectDialogProps): React.ReactElement | null {
  const router = useRouter();
  const createProject = useCreateProject();

  const [formData, setFormData] = useState<FormData>({
    name: "",
    sourceType: "",
    sourceUrl: "",
    description: "",
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
    name: false,
    sourceType: false,
    sourceUrl: false,
    description: false,
  });

  useEffect(() => {
    if (isOpen) {
      setFormData({ name: "", sourceType: "", sourceUrl: "", description: "" });
      setErrors({});
      setTouched({ name: false, sourceType: false, sourceUrl: false, description: false });
    }
  }, [isOpen]);

  const validateName = useCallback((name: string): string | undefined => {
    if (!name) {
      return "Project name is required";
    }
    if (name.length > MAX_NAME_LENGTH) {
      return `Name must be ${MAX_NAME_LENGTH} characters or less`;
    }
    if (!NAME_PATTERN.test(name)) {
      return "Name must contain only lowercase letters, numbers, and hyphens";
    }
    return undefined;
  }, []);

  const validateSourceUrl = useCallback((url: string, sourceType: string): string | undefined => {
    if (!url) {
      return sourceType === "" ? undefined : "Source URL is required";
    }

    if (sourceType === "git") {
      if (!HTTPS_PATTERN.test(url) && !SSH_PATTERN.test(url)) {
        return "Git URL must start with https:// or git@";
      }
    } else if (sourceType === "local") {
      if (!LOCAL_PATH_PATTERN.test(url)) {
        return "Invalid local path format. Use /path/to/dir or C:\\path\\to\\dir";
      }
    } else if (sourceType === "image") {
      if (!IMAGE_PATTERN.test(url)) {
        return "Invalid image format. Use registry/image:tag";
      }
    }

    return undefined;
  }, []);

  const handleFieldBlur = (field: keyof FormData): void => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    const newErrors: FormErrors = {};

    if (field === "name") {
      const nameError = validateName(formData.name);
      if (nameError) {
        newErrors.name = nameError;
      }
    }

    if (field === "sourceUrl" && formData.sourceUrl) {
      const urlError = validateSourceUrl(formData.sourceUrl, formData.sourceType);
      if (urlError) {
        newErrors.sourceUrl = urlError;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors((prev) => ({ ...prev, ...newErrors }));
    }
  };

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    setTouched({ name: true, sourceType: true, sourceUrl: true, description: true });

    const newErrors: FormErrors = {};

    const nameError = validateName(formData.name);
    if (nameError) {
      newErrors.name = nameError;
    }

    const urlError = validateSourceUrl(formData.sourceUrl, formData.sourceType);
    if (urlError) {
      newErrors.sourceUrl = urlError;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setErrors({});

    try {
      const result = await createProject.mutateAsync({
        name: formData.name,
        sourceType: (formData.sourceType || undefined) as ProjectSourceType | undefined,
        sourceUrl: formData.sourceUrl || undefined,
        metadata: formData.description ? { description: formData.description } : undefined,
      });

      onClose();
      await router.navigate({ to: `/projects/${result.id}` });
    } catch (err) {
      const error = err as ApiClientError;

      if (error.code === "CONFLICT") {
        setErrors({ name: "A project with this name already exists" });
      } else if (error.code === "VALIDATION_ERROR") {
        setErrors({ general: "Invalid input. Please check your entries." });
      } else {
        setErrors({ general: error.message || "Failed to create project. Please try again." });
      }
    }
  };

  const handleClose = useCallback(() => {
    if (!createProject.isPending) {
      onClose();
    }
  }, [onClose, createProject.isPending]);

  if (!isOpen) {
    return null;
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
        >
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Project Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onBlur={() => handleFieldBlur("name")}
                placeholder="my-awesome-app"
                disabled={createProject.isPending}
                aria-invalid={touched.name && !!errors.name}
              />
              {touched.name && errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Lowercase letters, numbers, and hyphens only
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="sourceType" className="text-sm font-medium">
                Source Type <span className="text-destructive">*</span>
              </label>
              <Select
                value={formData.sourceType}
                onValueChange={(value) =>
                  setFormData({
                    ...formData,
                    sourceType: value as "git" | "local" | "image",
                    sourceUrl: "",
                  })
                }
                disabled={createProject.isPending}
              >
                <SelectTrigger id="sourceType" className="w-full">
                  <SelectValue placeholder="Select source type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="git">Git Repository</SelectItem>
                  <SelectItem value="local">Local Path</SelectItem>
                  <SelectItem value="image">Docker Registry</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Choose where your project source is located
              </p>
            </div>

            {formData.sourceType && (
              <div className="space-y-2">
                <label htmlFor="sourceUrl" className="text-sm font-medium">
                  {formData.sourceType === "git" && "Git Repository URL"}
                  {formData.sourceType === "local" && "Local Path"}
                  {formData.sourceType === "image" && "Image Reference"}
                  <span className="text-destructive">*</span>
                </label>
                <Input
                  id="sourceUrl"
                  value={formData.sourceUrl}
                  onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                  onBlur={() => handleFieldBlur("sourceUrl")}
                  placeholder={
                    formData.sourceType === "git"
                      ? "https://github.com/username/repo"
                      : formData.sourceType === "local"
                        ? "/path/to/project"
                        : "registry.example.com/image:tag"
                  }
                  disabled={createProject.isPending}
                  aria-invalid={touched.sourceUrl && !!errors.sourceUrl}
                />
                {touched.sourceUrl && errors.sourceUrl && (
                  <p className="text-sm text-destructive">{errors.sourceUrl}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formData.sourceType === "git" && "Enter HTTPS or SSH URL"}
                  {formData.sourceType === "local" && "Absolute path to project directory"}
                  {formData.sourceType === "image" && "Docker image with registry and tag"}
                </p>
              </div>
            )}

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
                placeholder="A brief description of your project"
                rows={3}
                disabled={createProject.isPending}
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
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={createProject.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createProject.isPending}>
              {createProject.isPending ? "Creating..." : "Create Project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
