import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { AlertsList } from "./components/AlertsList";
import { AlertRulesList } from "./components/AlertRulesList";
import { AlertChannelsList } from "./components/AlertChannelsList";

type AlertTab = "alerts" | "rules" | "channels";

export function AlertsPage(): React.ReactElement {
  const [tab, setTab] = useState<AlertTab>("alerts");

  return (
    <div className="space-y-6">
      <div className="border-b border-border/50 pb-4">
        <h1 className="font-serif text-3xl font-bold">Alerts</h1>
        <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Alert management &amp; configuration
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as AlertTab)}>
        <TabsList>
          <TabsTrigger value="alerts">Active Alerts</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <AlertsList />
        </TabsContent>

        <TabsContent value="rules">
          <AlertRulesList />
        </TabsContent>

        <TabsContent value="channels">
          <AlertChannelsList />
        </TabsContent>
      </Tabs>
    </div>
  );
}
