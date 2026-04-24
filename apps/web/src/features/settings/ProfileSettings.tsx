import { useState, useEffect } from "react";
import { useAuth } from "@/core/auth";
import { useUpdateProfile } from "@/core/api/hooks/useSettings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/shared/components/ui/alert";
import { UserIcon, CheckIcon } from "lucide-react";

export function ProfileSettings(): React.ReactElement {
  const { user } = useAuth();
  const updateProfile = useUpdateProfile();

  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  // Sync local state when user data refreshes (e.g. after successful update)
  useEffect(() => {
    if (user) {
      setName(user.name ?? "");
      setEmail(user.email);
    }
  }, [user]);

  const hasChanges = name !== (user?.name ?? "") || email !== user?.email;

  const handleSave = (): void => {
    if (!hasChanges) return;
    const data: { name?: string; email?: string } = {};
    if (name !== (user?.name ?? "")) data.name = name;
    if (email !== user?.email) data.email = email;
    updateProfile.mutate(data);
  };

  return (
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
        {updateProfile.isSuccess && (
          <Alert className="border-success-500/20 bg-success-500/5">
            <div className="flex h-5 w-5 items-center justify-center rounded-md bg-success-500/10">
              <CheckIcon className="h-3 w-3 text-success-500" />
            </div>
            <AlertTitle className="font-serif text-sm">Profile updated</AlertTitle>
            <AlertDescription className="font-sans text-xs text-muted-foreground">
              Your profile changes have been saved.
            </AlertDescription>
          </Alert>
        )}

        {updateProfile.isError && (
          <Alert variant="destructive">
            <AlertTitle className="font-serif text-sm">Update failed</AlertTitle>
            <AlertDescription className="font-sans text-xs">
              {updateProfile.error?.message ?? "Failed to update profile. Please try again."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Full Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
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
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your.email@example.com"
            className="font-sans text-sm"
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button
          variant="default"
          onClick={handleSave}
          disabled={!hasChanges || updateProfile.isPending}
          className="font-sans text-sm"
        >
          {updateProfile.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </CardFooter>
    </Card>
  );
}
