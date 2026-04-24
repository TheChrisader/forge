import { useState } from "react";
import { useChangePassword } from "@/core/api/hooks/useSettings";
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
import { KeyIcon, CheckIcon } from "lucide-react";

export function PasswordSettings(): React.ReactElement {
  const changePassword = useChangePassword();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const validate = (): boolean => {
    if (!currentPassword) {
      setValidationError("Current password is required.");
      return false;
    }
    if (newPassword.length < 12) {
      setValidationError("New password must be at least 12 characters.");
      return false;
    }
    if (newPassword !== confirmPassword) {
      setValidationError("Passwords do not match.");
      return false;
    }
    setValidationError(null);
    return true;
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!validate()) return;
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setValidationError(null);
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
            <KeyIcon className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="font-serif">Change Password</CardTitle>
        </div>
        <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
          Update your password to keep your account secure
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-5">
          {changePassword.isSuccess && (
            <Alert className="border-success-500/20 bg-success-500/5">
              <div className="flex h-5 w-5 items-center justify-center rounded-md bg-success-500/10">
                <CheckIcon className="h-3 w-3 text-success-500" />
              </div>
              <AlertTitle className="font-serif text-sm">Password changed</AlertTitle>
              <AlertDescription className="font-sans text-xs text-muted-foreground">
                Your password has been updated. You may need to log in again on other devices.
              </AlertDescription>
            </Alert>
          )}

          {(validationError || changePassword.isError) && (
            <Alert variant="destructive">
              <AlertTitle className="font-serif text-sm">Error</AlertTitle>
              <AlertDescription className="font-sans text-xs">
                {validationError ?? changePassword.error?.message ?? "Failed to change password."}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Current Password
            </label>
            <Input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="font-sans text-sm"
              autoComplete="current-password"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              New Password
            </label>
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 12 characters"
              className="font-sans text-sm"
              autoComplete="new-password"
            />
          </div>

          <div className="space-y-2">
            <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              Confirm New Password
            </label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="font-sans text-sm"
              autoComplete="new-password"
            />
          </div>
        </CardContent>
        <CardFooter className="mt-6">
          <Button
            type="submit"
            variant="default"
            disabled={changePassword.isPending}
            className="font-sans text-sm"
          >
            {changePassword.isPending ? "Changing..." : "Change Password"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
