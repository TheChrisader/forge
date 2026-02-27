import { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { Switch } from "@/shared/components/ui/switch";
import { usePatchProject } from "@/core/api/hooks/useProjects";
import type { ApiClientError } from "@/core/api/client";
import type { Project } from "@forge/types";

interface HealthSettingsProps {
  project: Project;
}

interface FormErrors {
  general?: string;
  testCommand?: string;
}

const DURATION_PRESETS = ["5s", "10s", "30s", "1m", "5m"] as const;

export function HealthSettings({ project }: HealthSettingsProps): React.ReactElement {
  const config = (project.config as Record<string, unknown> | null | undefined) || {};
  const healthCheckConfig = (config.healthCheck as Record<string, unknown> | undefined) || {};
  const lifecycleConfig = (config.lifecycle as Record<string, unknown> | undefined) || {};

  const healthTest = (healthCheckConfig.test as string[] | undefined) || [];

  const [formData, setFormData] = useState({
    testCommand: arrayToString(healthTest),
    interval: (healthCheckConfig.interval as string | undefined) || "",
    timeout: (healthCheckConfig.timeout as string | undefined) || "",
    retries: (healthCheckConfig.retries as number | undefined) ?? "",
    startPeriod: (healthCheckConfig.startPeriod as string | undefined) || "",
    restart:
      (lifecycleConfig.restart as "no" | "always" | "on-failure" | "unless-stopped" | undefined) ||
      "",
    restartRetries: (lifecycleConfig.restartRetries as number | undefined) ?? "",
    autoRemove: (lifecycleConfig.autoRemove as boolean | undefined) ?? false,
  });

  const [errors, setErrors] = useState<FormErrors>({});

  const updateProject = usePatchProject();

  const handleSave = async (): Promise<void> => {
    setErrors({});

    if (formData.testCommand) {
      const testArray = stringToArray(formData.testCommand);
      if (testArray.length === 0) {
        setErrors({ testCommand: "Test command cannot be empty" });
        return;
      }
    }

    if (formData.retries && isNaN(Number(formData.retries))) {
      setErrors({ general: "Invalid retries value" });
      return;
    }
    if (formData.restartRetries && isNaN(Number(formData.restartRetries))) {
      setErrors({ general: "Invalid restart retries value" });
      return;
    }

    const durationPattern = /^\d+(\.\d+)?(s|m|h|ms|us)$/i;
    if (formData.interval && !durationPattern.test(formData.interval)) {
      setErrors({ general: "Invalid interval format. Use format like 30s or 1m" });
      return;
    }
    if (formData.timeout && !durationPattern.test(formData.timeout)) {
      setErrors({ general: "Invalid timeout format. Use format like 10s or 30s" });
      return;
    }
    if (formData.startPeriod && !durationPattern.test(formData.startPeriod)) {
      setErrors({ general: "Invalid start period format. Use format like 30s or 1m" });
      return;
    }

    try {
      const testArray = formData.testCommand ? stringToArray(formData.testCommand) : undefined;

      await updateProject.mutateAsync({
        id: project.id,
        data: {
          config: {
            ...(typeof config === "object" ? config : {}),
            healthCheck: testArray
              ? {
                  test: testArray,
                  interval: formData.interval || undefined,
                  timeout: formData.timeout || undefined,
                  retries: formData.retries ? Number(formData.retries) : undefined,
                  startPeriod: formData.startPeriod || undefined,
                }
              : undefined,
            lifecycle: {
              ...(typeof lifecycleConfig === "object" ? lifecycleConfig : {}),
              restart: formData.restart || undefined,
              restartRetries: formData.restartRetries ? Number(formData.restartRetries) : undefined,
              autoRemove: formData.autoRemove || undefined,
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
    formData.testCommand !== arrayToString(healthTest) ||
    formData.interval !== ((healthCheckConfig.interval as string | undefined) || "") ||
    formData.timeout !== ((healthCheckConfig.timeout as string | undefined) || "") ||
    formData.retries !== ((healthCheckConfig.retries as number | undefined) ?? "") ||
    formData.startPeriod !== ((healthCheckConfig.startPeriod as string | undefined) || "") ||
    formData.restart !== ((lifecycleConfig.restart as string | undefined) || "") ||
    formData.restartRetries !== ((lifecycleConfig.restartRetries as number | undefined) ?? "") ||
    formData.autoRemove !== ((lifecycleConfig.autoRemove as boolean | undefined) ?? false);

  return (
    <div className="space-y-6">
      {/* Health Check Section */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Health Check</h3>
          <p className="text-xs text-muted-foreground">
            Configure how the container health is monitored
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="testCommand" className="text-sm font-medium">
            Test Command
          </label>
          <Input
            id="testCommand"
            value={formData.testCommand}
            onChange={(e) => setFormData({ ...formData, testCommand: e.target.value })}
            placeholder="CMD-SHELL, curl -f http://localhost/ || exit 1"
            disabled={updateProject.isPending}
            className="font-mono"
          />
          {errors.testCommand && <p className="text-sm text-destructive">{errors.testCommand}</p>}
          <p className="text-xs text-muted-foreground">
            Command to check health. Use comma-separated values (e.g., &quot;CMD-SHELL, curl -f
            http://localhost/&quot;). Leave empty to disable health checks.
          </p>
        </div>

        {formData.testCommand && (
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label htmlFor="interval" className="text-sm font-medium">
                Interval
              </label>
              <div className="flex gap-2">
                <Select
                  value={DURATION_PRESETS.find((v) => formData.interval === v) || "custom"}
                  onValueChange={(value) => {
                    if (value !== "custom") {
                      setFormData({ ...formData, interval: value });
                    }
                  }}
                  disabled={updateProject.isPending}
                >
                  <SelectTrigger className="w-25">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_PRESETS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="interval"
                  value={formData.interval}
                  onChange={(e) => setFormData({ ...formData, interval: e.target.value })}
                  placeholder="30s"
                  disabled={updateProject.isPending}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">Time between checks</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="timeout" className="text-sm font-medium">
                Timeout
              </label>
              <div className="flex gap-2">
                <Select
                  value={DURATION_PRESETS.find((v) => formData.timeout === v) || "custom"}
                  onValueChange={(value) => {
                    if (value !== "custom") {
                      setFormData({ ...formData, timeout: value });
                    }
                  }}
                  disabled={updateProject.isPending}
                >
                  <SelectTrigger className="w-25">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_PRESETS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="timeout"
                  value={formData.timeout}
                  onChange={(e) => setFormData({ ...formData, timeout: e.target.value })}
                  placeholder="10s"
                  disabled={updateProject.isPending}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">Max time per check</p>
            </div>

            <div className="space-y-2">
              <label htmlFor="startPeriod" className="text-sm font-medium">
                Start Period
              </label>
              <div className="flex gap-2">
                <Select
                  value={DURATION_PRESETS.find((v) => formData.startPeriod === v) || "custom"}
                  onValueChange={(value) => {
                    if (value !== "custom") {
                      setFormData({ ...formData, startPeriod: value });
                    }
                  }}
                  disabled={updateProject.isPending}
                >
                  <SelectTrigger className="w-25">
                    <SelectValue placeholder="Preset" />
                  </SelectTrigger>
                  <SelectContent>
                    {DURATION_PRESETS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {value}
                      </SelectItem>
                    ))}
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  id="startPeriod"
                  value={formData.startPeriod}
                  onChange={(e) => setFormData({ ...formData, startPeriod: e.target.value })}
                  placeholder="30s"
                  disabled={updateProject.isPending}
                  className="font-mono"
                />
              </div>
              <p className="text-xs text-muted-foreground">Grace period on startup</p>
            </div>
          </div>
        )}

        {formData.testCommand && (
          <div className="space-y-2">
            <label htmlFor="retries" className="text-sm font-medium">
              Consecutive Failures
            </label>
            <Input
              id="retries"
              type="number"
              min="0"
              value={formData.retries}
              onChange={(e) => setFormData({ ...formData, retries: e.target.value })}
              placeholder="3"
              disabled={updateProject.isPending}
              className="max-w-50"
            />
            <p className="text-xs text-muted-foreground">
              Number of consecutive failures before marking as unhealthy
            </p>
          </div>
        )}
      </div>

      {/* Lifecycle Section */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Container Lifecycle</h3>
          <p className="text-xs text-muted-foreground">
            Configure container restart and cleanup behavior
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="restart" className="text-sm font-medium">
            Restart Policy
          </label>
          <Select
            value={formData.restart || "no"}
            onValueChange={(value) => setFormData({ ...formData, restart: value })}
            disabled={updateProject.isPending}
          >
            <SelectTrigger id="restart">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="no">No (don't restart)</SelectItem>
              <SelectItem value="always">Always (restart indefinitely)</SelectItem>
              <SelectItem value="on-failure">On Failure</SelectItem>
              <SelectItem value="unless-stopped">Unless Stopped</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            {formData.restart === "no" && "Container will not be restarted if it exits"}
            {formData.restart === "always" &&
              "Container will always restart regardless of exit status"}
            {formData.restart === "on-failure" &&
              "Container restarts only on failure (non-zero exit)"}
            {formData.restart === "unless-stopped" && "Container restarts unless manually stopped"}
          </p>
        </div>

        {formData.restart === "on-failure" && (
          <div className="space-y-2">
            <label htmlFor="restartRetries" className="text-sm font-medium">
              Maximum Restart Attempts
            </label>
            <Input
              id="restartRetries"
              type="number"
              min="0"
              value={formData.restartRetries}
              onChange={(e) => setFormData({ ...formData, restartRetries: e.target.value })}
              placeholder="10"
              disabled={updateProject.isPending}
              className="max-w-50"
            />
            <p className="text-xs text-muted-foreground">
              Maximum number of restart attempts before giving up
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <label htmlFor="autoRemove" className="text-sm font-medium">
              Auto Remove Container
            </label>
            <p className="text-xs text-muted-foreground">
              Automatically remove container when it exits
            </p>
          </div>
          <Switch
            id="autoRemove"
            checked={formData.autoRemove}
            onCheckedChange={(checked) => setFormData({ ...formData, autoRemove: checked })}
            disabled={updateProject.isPending}
          />
        </div>
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
          disabled={updateProject.isPending || !hasChanges}
        >
          {updateProject.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}

function arrayToString(value: string[] | undefined): string {
  if (!value || value.length === 0) return "";
  return value.join(", ");
}

function stringToArray(value: string): string[] {
  if (!value.trim()) return [];
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
