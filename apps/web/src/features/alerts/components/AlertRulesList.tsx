import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import { useAlertRules, useDeleteAlertRule, useUpdateAlertRule } from "@/core/api/hooks/useAlerts";
import { CreateAlertRuleModal } from "./CreateAlertRuleModal";
import { cn } from "@/shared/lib/utils";

const OPERATOR_LABEL: Record<string, string> = {
  GREATER_THAN: ">",
  LESS_THAN: "<",
  EQUALS: "=",
  NOT_EQUALS: "!=",
};

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  CRITICAL: "destructive",
  WARNING: "secondary",
  INFO: "outline",
};

export function AlertRulesList(): React.ReactElement {
  const { data, isLoading } = useAlertRules({ limit: 100 });
  const deleteRule = useDeleteAlertRule();
  const updateRule = useUpdateAlertRule();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const rules = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">
          {rules.length} rule{rules.length !== 1 ? "s" : ""}
        </span>
        <Button
          size="sm"
          className="font-mono text-xs h-8"
          onClick={() => {
            setEditingRuleId(null);
            setModalOpen(true);
          }}
        >
          <Plus className="mr-1 h-3 w-3" />
          New Rule
        </Button>
      </div>

      {rules.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 p-8">
          <p className="font-mono text-xs text-muted-foreground">
            No alert rules configured. Create one to start monitoring.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "flex items-center gap-4 rounded-lg border border-border/50 p-3",
                !rule.enabled && "opacity-50"
              )}
            >
              <Switch
                checked={rule.enabled}
                onCheckedChange={(checked) =>
                  updateRule.mutate({ id: rule.id, data: { enabled: checked } })
                }
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-sans text-sm font-medium truncate">{rule.name}</span>
                  <Badge variant={SEVERITY_VARIANT[rule.severity] ?? "outline"}>
                    {rule.severity}
                  </Badge>
                </div>
                <p className="font-mono text-[10px] text-muted-foreground mt-0.5">
                  {rule.metric} {OPERATOR_LABEL[rule.operator] ?? rule.operator} {rule.threshold}
                  {rule.duration > 0 && ` for ${rule.duration}s`}
                </p>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={() => {
                    setEditingRuleId(rule.id);
                    setModalOpen(true);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                  disabled={deleteRule.isPending}
                  onClick={() => deleteRule.mutate(rule.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <CreateAlertRuleModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRuleId(null);
        }}
        ruleId={editingRuleId}
      />
    </div>
  );
}
