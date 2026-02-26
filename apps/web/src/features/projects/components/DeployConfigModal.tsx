import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { LoaderIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useCreateDeployment } from "@/core/api/hooks/useDeployments";

interface DeployConfigModalProps {
  projectId: string;
  defaultBranch?: string;
  onSuccess?: () => void;
}

const deployConfigSchema = z.object({
  gitBranch: z.string().min(1, "Branch is required").max(255, "Branch name too long"),
  gitCommit: z
    .string()
    .regex(/^[a-f0-9]{7,40}$/i, {
      message: "Invalid commit SHA (must be 7-40 hex characters)",
    })
    .optional()
    .or(z.literal("")),
  buildArgs: z.record(z.string(), z.string()).optional(),
});

type DeployConfigFormData = z.infer<typeof deployConfigSchema>;

export function DeployConfigModal({
  projectId,
  defaultBranch = "main",
  onSuccess,
  children,
}: DeployConfigModalProps & { children?: React.ReactNode }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [buildArgsEntries, setBuildArgsEntries] = useState<Array<{ key: string; value: string }>>(
    []
  );

  const createDeployment = useCreateDeployment();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DeployConfigFormData>({
    resolver: zodResolver(deployConfigSchema),
    defaultValues: {
      gitBranch: defaultBranch,
    },
  });

  const onSubmit = async (data: DeployConfigFormData): Promise<void> => {
    try {
      const buildArgs: Record<string, string> = {};
      for (const entry of buildArgsEntries) {
        if (entry.key.trim()) {
          buildArgs[entry.key.trim()] = entry.value.trim();
        }
      }

      await createDeployment.mutateAsync({
        projectId,
        gitBranch: data.gitBranch || defaultBranch,
        gitCommit: data.gitCommit || undefined,
        buildArgs: Object.keys(buildArgs).length > 0 ? buildArgs : undefined,
      });

      toast.success("Deployment started successfully", {
        description: `Deploying branch: ${data.gitBranch || defaultBranch}`,
      });

      setOpen(false);
      reset();
      setBuildArgsEntries([]);
      onSuccess?.();
    } catch (error) {
      const err = error as { code?: string; message?: string };
      if (err.code === "CONFLICT") {
        toast.error("Deployment failed", {
          description: "A deployment is already in progress for this project",
        });
      } else if (err.code === "NOT_FOUND") {
        toast.error("Deployment failed", {
          description: "Project not found",
        });
      } else {
        toast.error("Deployment failed", {
          description: err.message || "Failed to start deployment. Please try again.",
        });
      }
    }
  };

  const handleOpenChange = (newOpen: boolean): void => {
    if (!newOpen || !isSubmitting) {
      setOpen(newOpen);
      if (!newOpen) {
        reset();
        setBuildArgsEntries([]);
      }
    }
  };

  const addBuildArg = (): void => {
    setBuildArgsEntries([...buildArgsEntries, { key: "", value: "" }]);
  };

  const removeBuildArg = (index: number): void => {
    setBuildArgsEntries(buildArgsEntries.filter((_, i) => i !== index));
  };

  const updateBuildArgKey = (index: number, key: string): void => {
    const newEntries = [...buildArgsEntries];
    newEntries[index].key = key;
    setBuildArgsEntries(newEntries);
  };

  const updateBuildArgValue = (index: number, value: string): void => {
    const newEntries = [...buildArgsEntries];
    newEntries[index].value = value;
    setBuildArgsEntries(newEntries);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="sm:max-w-md">
        <form onSubmit={void handleSubmit(onSubmit)}>
          <DialogHeader>
            <DialogTitle>Deploy with Options</DialogTitle>
            <DialogDescription>
              Configure git branch, commit, and build arguments for this deployment
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="gitBranch">
                Git Branch <span className="text-destructive">*</span>
              </Label>
              <Input
                id="gitBranch"
                placeholder={defaultBranch}
                {...register("gitBranch")}
                className={errors.gitBranch ? "border-destructive" : ""}
              />
              {errors.gitBranch && (
                <p className="text-sm text-destructive">{errors.gitBranch.message}</p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="gitCommit">Commit SHA (Optional)</Label>
              <Input
                id="gitCommit"
                placeholder="a1b2c3d"
                {...register("gitCommit")}
                className={errors.gitCommit ? "border-destructive" : ""}
              />
              {errors.gitCommit && (
                <p className="text-sm text-destructive">{errors.gitCommit.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Deploy a specific commit instead of the latest on the branch
              </p>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Build Args (Optional)</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBuildArg}
                  className="h-7"
                >
                  <PlusIcon className="mr-1 h-3 w-3" />
                  Add Arg
                </Button>
              </div>

              {buildArgsEntries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No build arguments configured. Click "Add Arg" to add build-time variables.
                </p>
              ) : (
                <div className="space-y-2">
                  {buildArgsEntries.map((entry, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="KEY"
                        value={entry.key}
                        onChange={(e) => updateBuildArgKey(index, e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        placeholder="value"
                        value={entry.value}
                        onChange={(e) => updateBuildArgValue(index, e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => removeBuildArg(index)}
                        className="h-9 w-9 shrink-0"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Build arguments are set at build-time and are not available in the running container
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
                  Starting...
                </>
              ) : (
                "Start Deployment"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
