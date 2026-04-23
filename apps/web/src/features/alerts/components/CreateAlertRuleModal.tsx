import { useState, useEffect } from "react";
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
import { useCreateAlertRule, useUpdateAlertRule, useAlertRule } from "@/core/api/hooks/useAlerts";
import type { ApiClientError } from "@/core/api/client";

interface CreateAlertRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  ruleId?: string | null;
}

const OPERATORS = [
  { value: "GREATER_THAN", label: "Greater than (>)" },
  { value: "LESS_THAN", label: "Less than (<)" },
  { value: "EQUALS", label: "Equals (=)" },
  { value: "NOT_EQUALS", label: "Not equals (!=)" },
] as const;

const SEVERITIES = [
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
  { value: "CRITICAL", label: "Critical" },
] as const;

export function CreateAlertRuleModal({
  isOpen,
  onClose,
  ruleId,
}: CreateAlertRuleModalProps): React.ReactElement | null {
  const isEditing = !!ruleId;
  const createRule = useCreateAlertRule();
  const updateRule = useUpdateAlertRule();
  const { data: existingRule } = useAlertRule(ruleId ?? "");

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [metric, setMetric] = useState("");
  const [operator, setOperator] = useState("GREATER_THAN");
  const [threshold, setThreshold] = useState("90");
  const [duration, setDuration] = useState("0");
  const [severity, setSeverity] = useState("WARNING");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && existingRule) {
      setName(existingRule.name);
      setDescription(existingRule.description ?? "");
      setMetric(existingRule.metric);
      setOperator(existingRule.operator);
      setThreshold(String(existingRule.threshold));
      setDuration(String(existingRule.duration));
      setSeverity(existingRule.severity);
      setError(null);
    } else if (isOpen && !existingRule) {
      setName("");
      setDescription("");
      setMetric("");
      setOperator("GREATER_THAN");
      setThreshold("90");
      setDuration("0");
      setSeverity("WARNING");
      setError(null);
    }
  }, [isOpen, existingRule]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);

    if (!name.trim()) {
      setError("Rule name is required");
      return;
    }
    if (!metric.trim()) {
      setError("Metric name is required");
      return;
    }

    const thresholdNum = Number(threshold);
    if (isNaN(thresholdNum)) {
      setError("Threshold must be a number");
      return;
    }

    const durationNum = Number(duration);
    if (isNaN(durationNum) || durationNum < 0) {
      setError("Duration must be a non-negative number");
      return;
    }

    try {
      if (isEditing && ruleId) {
        await updateRule.mutateAsync({
          id: ruleId,
          data: {
            name: name.trim(),
            description: description.trim() || null,
            metric: metric.trim(),
            operator: operator as "GREATER_THAN",
            threshold: thresholdNum,
            duration: durationNum,
            severity: severity as "WARNING",
          },
        });
      } else {
        await createRule.mutateAsync({
          projectId: "",
          name: name.trim(),
          description: description.trim() || null,
          metric: metric.trim(),
          operator: operator as "GREATER_THAN",
          threshold: thresholdNum,
          duration: durationNum,
          severity: severity as "WARNING",
        });
      }
      onClose();
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message ?? "Failed to save rule");
    }
  };

  const isPending = createRule.isPending || updateRule.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">
            {isEditing ? "Edit Alert Rule" : "Create Alert Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2">
              <p className="font-mono text-xs text-destructive">{error}</p>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Name
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. High CPU Usage"
              className="font-sans text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
              className="font-sans text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Metric
              </label>
              <Input
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                placeholder="e.g. cpu_usage_percent"
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Operator
              </label>
              <Select value={operator} onValueChange={setOperator}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value}>
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Threshold
              </label>
              <Input
                type="number"
                value={threshold}
                onChange={(e) => setThreshold(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Duration (s)
              </label>
              <Input
                type="number"
                min={0}
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Severity
              </label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger className="font-mono text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SEVERITIES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={void handleSubmit} disabled={isPending}>
            {isEditing ? "Update" : "Create"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
