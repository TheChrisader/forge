import { JSX, useState } from "react";
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

export function HealthSettings({ project }: HealthSettingsProps): JSX.Element {
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
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Health Check
        </div>

        <div className="gap-2 flex flex-col">
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
          <p className="text-xs text-muted-foreground font-mono">
            Leave empty to disable health checks
          </p>
        </div>

        {formData.testCommand && (
          <>
            <div className="grid grid-cols-3 gap-4">
              <DurationField
                label="Interval"
                value={formData.interval}
                onChange={(value) => setFormData({ ...formData, interval: value })}
                disabled={updateProject.isPending}
                placeholder="30s"
                helpText="Time between checks"
              />
              <DurationField
                label="Timeout"
                value={formData.timeout}
                onChange={(value) => setFormData({ ...formData, timeout: value })}
                disabled={updateProject.isPending}
                placeholder="10s"
                helpText="Max time per check"
              />
              <DurationField
                label="Start Period"
                value={formData.startPeriod}
                onChange={(value) => setFormData({ ...formData, startPeriod: value })}
                disabled={updateProject.isPending}
                placeholder="30s"
                helpText="Grace period on startup"
              />
            </div>

            <div className="space-y-2 max-w-xs">
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
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground font-mono">Before marking as unhealthy</p>
            </div>
          </>
        )}
      </div>

      <div className="border-t border-border/40" />

      {/* Lifecycle Section */}
      <div className="gap-2 flex flex-col">
        <div className="text-xs font-mono uppercase tracking-wider text-muted-foreground/70">
          Container Lifecycle
        </div>

        <div className="gap-2 flex flex-col">
          <label htmlFor="restart" className="text-sm font-medium">
            Restart Policy
          </label>
          <Select
            value={formData.restart || "no"}
            onValueChange={(value) => setFormData({ ...formData, restart: value })}
            disabled={updateProject.isPending}
          >
            <SelectTrigger id="restart" className="max-w-md">
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
            {formData.restart === "" && "Container will not be restarted if it exits"}
          </p>
        </div>

        {formData.restart === "on-failure" && (
          <div className="space-y-2 max-w-xs">
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
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground font-mono">Before giving up</p>
          </div>
        )}

        <div className="flex items-center justify-between py-1">
          <div>
            <label htmlFor="autoRemove" className="text-sm font-medium">
              Auto Remove Container
            </label>
            <p className="text-xs text-muted-foreground mt-0.5">
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

interface DurationFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  placeholder: string;
  helpText: string;
}

function DurationField({
  label,
  value,
  onChange,
  disabled,
  placeholder,
  helpText,
}: DurationFieldProps): JSX.Element {
  return (
    <div className="gap-2 flex flex-col">
      <label className="text-sm font-medium">{label}</label>
      <div className="flex gap-2">
        <Select
          value={DURATION_PRESETS.find((v) => value === v) || "custom"}
          onValueChange={(val) => {
            if (val !== "custom") {
              onChange(val);
            }
          }}
          disabled={disabled}
        >
          <SelectTrigger className="w-24">
            <SelectValue placeholder="Preset" />
          </SelectTrigger>
          <SelectContent>
            {DURATION_PRESETS.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
            <SelectItem value="custom">Custom</SelectItem>
          </SelectContent>
        </Select>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="font-mono"
        />
      </div>
      <p className="text-xs text-muted-foreground font-mono">{helpText}</p>
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
