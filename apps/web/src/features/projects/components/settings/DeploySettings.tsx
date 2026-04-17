import { useState } from "react";
import { toast } from "sonner";
import { LoaderIcon } from "lucide-react";
import { Label } from "@/shared/components/ui/label";
import { Button } from "@/shared/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/shared/components/ui/radio-group";
import { useUpdateProject } from "@/core/api/hooks/useProjects";
import { DEPLOYMENT_STRATEGIES, DISABLED_STRATEGIES } from "@/features/deployments/constants";
import type { DeploymentStrategy, Project } from "@forge/types";

interface DeploySettingsProps {
  project: Project;
}

export function DeploySettings({ project }: DeploySettingsProps): React.ReactElement {
  const updateProject = useUpdateProject();

  const config = (project.config as Record<string, unknown>) || {};
  const deployConfig = (config.deploy as Record<string, unknown>) || {};
  const currentStrategy = (deployConfig.strategy as DeploymentStrategy | undefined) ?? "ROLLING";

  const [selectedStrategy, setSelectedStrategy] = useState<DeploymentStrategy>(currentStrategy);

  const handleSave = async (): Promise<void> => {
    try {
      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            deploy: { strategy: selectedStrategy },
          } as Record<string, unknown>,
        },
      });
      toast.success("Deploy settings saved");
    } catch {
      toast.error("Failed to save deploy settings");
    }
  };

  const hasChanges = selectedStrategy !== currentStrategy;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="text-sm font-medium">Default Deployment Strategy</Label>
          <p className="text-xs text-muted-foreground">
            The strategy used when deploying via the quick deploy button. Can be overridden
            per-deployment in the deploy configuration modal.
          </p>
        </div>

        <RadioGroup
          value={selectedStrategy}
          onValueChange={(val) => setSelectedStrategy(val as DeploymentStrategy)}
          className="gap-2"
        >
          {DEPLOYMENT_STRATEGIES.map((s) => {
            const isDisabled = (DISABLED_STRATEGIES as readonly string[]).includes(s.value);
            return (
              <Label
                key={s.value}
                htmlFor={`settings-strategy-${s.value}`}
                className={`flex items-start gap-3 rounded-md border p-3 cursor-pointer
                  transition-colors
                  ${selectedStrategy === s.value ? "border-primary bg-primary/5" : ""}
                  ${isDisabled ? "opacity-40 cursor-not-allowed pointer-events-none" : "hover:bg-muted/50"}`}
              >
                <RadioGroupItem
                  value={s.value}
                  id={`settings-strategy-${s.value}`}
                  className="mt-0.5"
                  disabled={isDisabled}
                />
                <div>
                  <span className="text-sm font-medium">{s.label}</span>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.description}</p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      </div>

      <div className="flex items-center gap-3 pt-2 border-t border-border/40">
        <Button
          onClick={() => void handleSave()}
          disabled={!hasChanges || updateProject.isPending}
          size="sm"
        >
          {updateProject.isPending ? (
            <>
              <LoaderIcon className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
        {hasChanges && (
          <Button variant="ghost" size="sm" onClick={() => setSelectedStrategy(currentStrategy)}>
            Reset
          </Button>
        )}
      </div>
    </div>
  );
}
