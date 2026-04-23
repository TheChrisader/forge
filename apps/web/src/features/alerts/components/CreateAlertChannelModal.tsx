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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { useCreateAlertChannel } from "@/core/api/hooks/useAlerts";
import type { ApiClientError } from "@/core/api/client";

interface CreateAlertChannelModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHANNEL_TYPES = [
  { value: "WEBHOOK", label: "Webhook", fields: [{ key: "url", label: "Webhook URL" }] },
  { value: "SLACK", label: "Slack", fields: [{ key: "webhookUrl", label: "Slack Webhook URL" }] },
  {
    value: "DISCORD",
    label: "Discord",
    fields: [{ key: "webhookUrl", label: "Discord Webhook URL" }],
  },
  {
    value: "TEAMS",
    label: "Microsoft Teams",
    fields: [{ key: "webhookUrl", label: "Teams Webhook URL" }],
  },
  {
    value: "EMAIL",
    label: "Email",
    fields: [{ key: "emailAddress", label: "Email Address" }],
  },
  {
    value: "PAGERDUTY",
    label: "PagerDuty",
    fields: [{ key: "routingKey", label: "Routing Key" }],
  },
  { value: "SMS", label: "SMS", fields: [{ key: "phoneNumber", label: "Phone Number" }] },
] as const;

export function CreateAlertChannelModal({
  isOpen,
  onClose,
}: CreateAlertChannelModalProps): React.ReactElement | null {
  const createChannel = useCreateAlertChannel();

  const [name, setName] = useState("");
  const [type, setType] = useState("WEBHOOK");
  const [configFields, setConfigFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const selectedType = CHANNEL_TYPES.find((ct) => ct.value === type);

  useEffect(() => {
    if (isOpen) {
      setName("");
      setType("WEBHOOK");
      setConfigFields({});
      setError(null);
    }
  }, [isOpen]);

  const handleSubmit = async (): Promise<void> => {
    setError(null);

    if (!name.trim()) {
      setError("Channel name is required");
      return;
    }

    const config: Record<string, string> = {};
    for (const field of selectedType?.fields ?? []) {
      const value = configFields[field.key]?.trim();
      if (!value) {
        setError(`${field.label} is required`);
        return;
      }
      config[field.key] = value;
    }

    try {
      await createChannel.mutateAsync({
        name: name.trim(),
        type: type as "WEBHOOK",
        config,
      });
      onClose();
    } catch (err) {
      const apiErr = err as ApiClientError;
      setError(apiErr.message ?? "Failed to create channel");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif">Create Notification Channel</DialogTitle>
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
              placeholder="e.g. DevOps Slack"
              className="font-sans text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Type
            </label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v);
                setConfigFields({});
              }}
            >
              <SelectTrigger className="font-sans text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedType?.fields.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {field.label}
              </label>
              <Input
                value={configFields[field.key] ?? ""}
                onChange={(e) =>
                  setConfigFields((prev) => ({ ...prev, [field.key]: e.target.value }))
                }
                placeholder={field.key === "url" || field.key === "webhookUrl" ? "https://" : ""}
                className="font-mono text-xs"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={createChannel.isPending}>
            Cancel
          </Button>
          <Button onClick={void handleSubmit} disabled={createChannel.isPending}>
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
