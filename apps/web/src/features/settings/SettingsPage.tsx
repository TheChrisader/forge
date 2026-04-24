import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
import { ProfileSettings } from "./ProfileSettings";
import { PasswordSettings } from "./PasswordSettings";
import { ApiKeysSettings } from "./ApiKeysSettings";
import { TeamSettingsPage } from "./TeamSettingsPage";

export function SettingsPage(): React.ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Manage your account preferences and configuration
        </p>
      </div>

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="password">Password</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <ProfileSettings />
        </TabsContent>

        <TabsContent value="password" className="space-y-6">
          <PasswordSettings />
        </TabsContent>

        <TabsContent value="api-keys" className="space-y-6">
          <ApiKeysSettings />
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <TeamSettingsPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
