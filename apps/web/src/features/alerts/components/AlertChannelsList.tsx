import { useState } from "react";
import { Plus, Trash2, Link2 } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { Skeleton } from "@/shared/components/ui/skeleton";
import { Switch } from "@/shared/components/ui/switch";
import {
  useAlertChannels,
  useDeleteAlertChannel,
  useUpdateAlertChannel,
} from "@/core/api/hooks/useAlerts";
import { CreateAlertChannelModal } from "./CreateAlertChannelModal";
import { cn } from "@/shared/lib/utils";

const CHANNEL_TYPE_LABEL: Record<string, string> = {
  EMAIL: "Email",
  SLACK: "Slack",
  DISCORD: "Discord",
  TEAMS: "Teams",
  WEBHOOK: "Webhook",
  PAGERDUTY: "PagerDuty",
  SMS: "SMS",
};

export function AlertChannelsList(): React.ReactElement {
  const { data, isLoading } = useAlertChannels({ limit: 100 });
  const deleteChannel = useDeleteAlertChannel();
  const updateChannel = useUpdateAlertChannel();

  const [createOpen, setCreateOpen] = useState(false);

  const channels = data?.data ?? [];

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] text-muted-foreground">
          {channels.length} channel{channels.length !== 1 ? "s" : ""}
        </span>
        <Button size="sm" className="font-mono text-xs h-8" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1 h-3 w-3" />
          New Channel
        </Button>
      </div>

      {channels.length === 0 ? (
        <div className="flex items-center justify-center rounded-lg border border-dashed border-border/50 p-8">
          <p className="font-mono text-xs text-muted-foreground">
            No notification channels configured. Add one to receive alert notifications.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {channels.map((channel) => (
            <div
              key={channel.id}
              className={cn(
                "flex items-center gap-4 rounded-lg border border-border/50 p-3",
                !channel.enabled && "opacity-50"
              )}
            >
              <Switch
                checked={channel.enabled}
                onCheckedChange={(checked) =>
                  updateChannel.mutate({ id: channel.id, data: { enabled: checked } })
                }
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link2 className="h-3 w-3 text-muted-foreground" />
                  <span className="font-sans text-sm font-medium truncate">{channel.name}</span>
                  <Badge variant="outline">
                    {CHANNEL_TYPE_LABEL[channel.type] ?? channel.type}
                  </Badge>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                disabled={deleteChannel.isPending}
                onClick={() => deleteChannel.mutate(channel.id)}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <CreateAlertChannelModal isOpen={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
