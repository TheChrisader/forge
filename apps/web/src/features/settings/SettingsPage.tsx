import { useState } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs";
// import { Switch } from "@/shared/components/ui/switch";
// import {
//   Select,
//   SelectTrigger,
//   SelectValue,
//   SelectContent,
//   SelectItem,
// } from "@/shared/components/ui/select";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { Alert, AlertTitle, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";
import { UserIcon, KeyIcon, CheckIcon } from "lucide-react";
import { TeamSettingsPage } from "./TeamSettingsPage";

export function SettingsPage(): React.ReactElement {
  const [saveAlert, setSaveAlert] = useState(false);
  const [settings, setSettings] = useState({
    fullName: "John Doe",
    email: "john.doe@example.com",
    timezone: "America/New_York",
    language: "en",

    emailNotifications: true,
    pushNotifications: false,
    deploymentAlerts: true,
    errorAlerts: true,
    weeklyDigest: false,

    theme: "dark",
    defaultView: "list",
    autoRefresh: true,
    refreshInterval: 30,
  });

  const handleSave = (): void => {
    setSaveAlert(true);
    setTimeout(() => setSaveAlert(false), 3000);
  };

  const updateSetting = <K extends keyof typeof settings>(
    key: K,
    value: (typeof settings)[K]
  ): void => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-bold tracking-tight">Settings</h1>
        <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
          Manage your account preferences and configuration
        </p>
      </div>

      {saveAlert && (
        <Alert className="border-success-500/20 bg-success-500/5">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-success-500/10">
            <CheckIcon className="h-3 w-3 text-success-500" />
          </div>
          <AlertTitle className="font-serif text-sm">Settings saved</AlertTitle>
          <AlertDescription className="font-sans text-xs text-muted-foreground">
            Your preferences have been updated successfully.
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile">
        <TabsList>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          {/* <TabsTrigger value="notifications">Notifications</TabsTrigger> */}
          {/* <TabsTrigger value="preferences">Preferences</TabsTrigger> */}
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="font-serif">Profile Information</CardTitle>
              </div>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Update your personal information and account settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Full Name
                </label>
                <Input
                  value={settings.fullName}
                  onChange={(e) => updateSetting("fullName", e.target.value)}
                  placeholder="Enter your full name"
                  className="font-sans text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Email Address
                </label>
                <Input
                  type="email"
                  value={settings.email}
                  onChange={(e) => updateSetting("email", e.target.value)}
                  placeholder="your.email@example.com"
                  className="font-sans text-sm"
                />
              </div>

              {/* <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Timezone
                </label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => updateSetting("timezone", value)}
                >
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-sans text-sm">
                    <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                    <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                    <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                    <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                    <SelectItem value="Europe/London">London (GMT)</SelectItem>
                    <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                    <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}

              {/* <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Language
                </label>
                <Select
                  value={settings.language}
                  onValueChange={(value) => updateSetting("language", value)}
                >
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-sans text-sm">
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                    <SelectItem value="ja">日本語</SelectItem>
                  </SelectContent>
                </Select>
              </div> */}
            </CardContent>
          </Card>
        </TabsContent>

        {/* <TabsContent value="notifications" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <BellIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="font-serif">Notification Preferences</CardTitle>
              </div>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Choose how you want to receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <label className="font-sans text-sm font-medium group-hover:text-foreground transition-colors">
                    Email Notifications
                  </label>
                  <p className="font-sans text-xs text-muted-foreground">
                    Receive notifications via email
                  </p>
                </div>
                <Switch
                  checked={settings.emailNotifications}
                  onCheckedChange={(checked) => updateSetting("emailNotifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <label className="font-sans text-sm font-medium group-hover:text-foreground transition-colors">
                    Push Notifications
                  </label>
                  <p className="font-sans text-xs text-muted-foreground">
                    Receive push notifications in your browser
                  </p>
                </div>
                <Switch
                  checked={settings.pushNotifications}
                  onCheckedChange={(checked) => updateSetting("pushNotifications", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <label className="font-sans text-sm font-medium group-hover:text-foreground transition-colors">
                    Deployment Alerts
                  </label>
                  <p className="font-sans text-xs text-muted-foreground">
                    Get notified when deployments complete or fail
                  </p>
                </div>
                <Switch
                  checked={settings.deploymentAlerts}
                  onCheckedChange={(checked) => updateSetting("deploymentAlerts", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <label className="font-sans text-sm font-medium group-hover:text-foreground transition-colors">
                    Error Alerts
                  </label>
                  <p className="font-sans text-xs text-muted-foreground">
                    Receive alerts for critical errors and issues
                  </p>
                </div>
                <Switch
                  checked={settings.errorAlerts}
                  onCheckedChange={(checked) => updateSetting("errorAlerts", checked)}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <label className="font-sans text-sm font-medium group-hover:text-foreground transition-colors">
                    Weekly Digest
                  </label>
                  <p className="font-sans text-xs text-muted-foreground">
                    Receive a weekly summary of activity
                  </p>
                </div>
                <Switch
                  checked={settings.weeklyDigest}
                  onCheckedChange={(checked) => updateSetting("weeklyDigest", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent> */}

        {/* <TabsContent value="preferences" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <SlidersIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="font-serif">App Preferences</CardTitle>
              </div>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Customize your application experience
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Theme
                </label>
                <Select
                  value={settings.theme}
                  onValueChange={(value) => updateSetting("theme", value)}
                >
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-sans text-sm">
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="system">System</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Default View
                </label>
                <Select
                  value={settings.defaultView}
                  onValueChange={(value) => updateSetting("defaultView", value)}
                >
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-sans text-sm">
                    <SelectItem value="list">List View</SelectItem>
                    <SelectItem value="grid">Grid View</SelectItem>
                    <SelectItem value="table">Table View</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between group">
                <div className="space-y-0.5">
                  <label className="font-sans text-sm font-medium group-hover:text-foreground transition-colors">
                    Auto Refresh
                  </label>
                  <p className="font-sans text-xs text-muted-foreground">
                    Automatically refresh data on dashboard
                  </p>
                </div>
                <Switch
                  checked={settings.autoRefresh}
                  onCheckedChange={(checked) => updateSetting("autoRefresh", checked)}
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Refresh Interval
                </label>
                <Select
                  value={settings.refreshInterval.toString()}
                  onValueChange={(value) => updateSetting("refreshInterval", parseInt(value))}
                  disabled={!settings.autoRefresh}
                >
                  <SelectTrigger className="font-sans text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-sans text-sm">
                    <SelectItem value="15">15 seconds</SelectItem>
                    <SelectItem value="30">30 seconds</SelectItem>
                    <SelectItem value="60">1 minute</SelectItem>
                    <SelectItem value="300">5 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent> */}

        <TabsContent value="api-keys" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                  <KeyIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="font-serif">API Keys</CardTitle>
              </div>
              <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                Manage your API keys for external integrations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  API Key Label
                </label>
                <Input placeholder="e.g., Production API Key" className="font-sans text-sm" />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Description
                </label>
                <Textarea
                  placeholder="Describe what this key will be used for..."
                  rows={3}
                  className="font-sans text-sm"
                />
              </div>

              <div className="space-y-2">
                <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                  Existing API Keys
                </label>
                <div className="rounded-md border p-4 space-y-3">
                  <div className="flex items-center justify-between group">
                    <div>
                      <p className="font-sans text-sm font-medium">Production Key</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        sk_****************************xyz
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="font-sans text-xs">
                      Revoke
                    </Button>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between group">
                    <div>
                      <p className="font-sans text-sm font-medium">Development Key</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        sk_****************************abc
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="font-sans text-xs">
                      Revoke
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button variant="default" className="font-sans text-sm">
                Generate New Key
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <TeamSettingsPage />
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3">
        <Button variant="outline" className="font-sans text-sm">
          Cancel
        </Button>
        <Button variant="default" onClick={handleSave} className="font-sans text-sm">
          Save Changes
        </Button>
      </div>
    </div>
  );
}
