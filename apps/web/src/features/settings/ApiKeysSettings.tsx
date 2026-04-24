import { useState } from "react";
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from "@/core/api/hooks/useSettings";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Alert, AlertTitle, AlertDescription } from "@/shared/components/ui/alert";
import { Separator } from "@/shared/components/ui/separator";
import { Spinner } from "@/shared/components/ui/spinner";
import { Badge } from "@/shared/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/shared/components/ui/alert-dialog";
import { KeyIcon, CopyIcon, CheckIcon, PlusIcon } from "lucide-react";

export function ApiKeysSettings(): React.ReactElement {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createApiKey = useCreateApiKey();
  const revokeApiKey = useRevokeApiKey();

  const [keyName, setKeyName] = useState("");
  const [newKey, setNewKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = (): void => {
    if (!keyName.trim()) return;
    createApiKey.mutate(
      { name: keyName.trim() },
      {
        onSuccess: (response) => {
          setKeyName("");
          setNewKey(response.key);
          setCopied(false);
        },
      }
    );
  };

  const handleCopy = async (): Promise<void> => {
    if (!newKey) return;
    await navigator.clipboard.writeText(newKey);
    setCopied(true);
  };

  const handleDismissKey = (): void => {
    setNewKey(null);
    setCopied(false);
  };

  const handleRevoke = (id: string): void => {
    revokeApiKey.mutate(id);
  };

  if (isLoading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Spinner className="h-8 w-8" />
      </div>
    );
  }

  return (
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
        {newKey && (
          <Alert className="border-warning-500/20 bg-warning-500/5">
            <div className="flex flex-col gap-3">
              <div>
                <AlertTitle className="font-serif text-sm">API Key Created — Copy Now</AlertTitle>
                <AlertDescription className="font-sans text-xs text-muted-foreground">
                  This is the only time you will see this key. Copy it now — it cannot be retrieved
                  later.
                </AlertDescription>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border border-border/50 bg-muted/50 px-3 py-2 font-mono text-xs break-all">
                  {newKey}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void handleCopy()}
                  className="font-sans text-xs shrink-0"
                >
                  {copied ? (
                    <CheckIcon className="mr-1 h-3 w-3 text-success-500" />
                  ) : (
                    <CopyIcon className="mr-1 h-3 w-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDismissKey}
                className="font-sans text-xs w-fit"
              >
                Dismiss
              </Button>
            </div>
          </Alert>
        )}

        {createApiKey.isError && (
          <Alert variant="destructive">
            <AlertTitle className="font-serif text-sm">Error</AlertTitle>
            <AlertDescription className="font-sans text-xs">
              {createApiKey.error?.message ?? "Failed to create API key."}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Create New Key
          </label>
          <div className="flex gap-2">
            <Input
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="e.g., Production API Key"
              className="font-sans text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreate();
              }}
            />
            <Button
              variant="default"
              onClick={handleCreate}
              disabled={!keyName.trim() || createApiKey.isPending}
              className="font-sans text-sm shrink-0"
            >
              <PlusIcon className="mr-1 h-3 w-3" />
              {createApiKey.isPending ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          <label className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            Existing API Keys
          </label>
          {apiKeys && apiKeys.length > 0 ? (
            <div className="rounded-md border p-4 space-y-3">
              {apiKeys.map((key, i) => (
                <div key={key.id}>
                  <div className="flex items-center justify-between group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-sans text-sm font-medium">{key.name}</p>
                        {key.scopes.length > 0 &&
                          key.scopes.map((scope) => (
                            <Badge key={scope} variant="secondary" className="font-mono text-[9px]">
                              {scope}
                            </Badge>
                          ))}
                      </div>
                      <p className="font-mono text-xs text-muted-foreground">
                        forge_{key.prefix}****************************
                      </p>
                      <p className="font-mono text-[9px] text-muted-foreground/60">
                        Created {new Date(key.createdAt).toLocaleDateString()}
                        {key.expiresAt && (
                          <>
                            {" — "}
                            {new Date(key.expiresAt) < new Date() ? (
                              <span className="text-destructive">Expired</span>
                            ) : (
                              <>Expires {new Date(key.expiresAt).toLocaleDateString()}</>
                            )}
                          </>
                        )}
                      </p>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="font-sans text-xs shrink-0">
                          Revoke
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-serif">Revoke API Key</AlertDialogTitle>
                          <AlertDialogDescription className="font-sans text-sm">
                            Are you sure you want to revoke &quot;{key.name}&quot;? Any integrations
                            using this key will immediately lose access. This action cannot be
                            undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="font-sans text-sm">
                            Cancel
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRevoke(key.id)}
                            className="font-sans text-sm bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Revoke Key
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                  {i < apiKeys.length - 1 && <Separator className="mt-3" />}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border p-8 text-center">
              <KeyIcon className="mx-auto h-8 w-8 text-muted-foreground/30" />
              <p className="font-sans text-sm text-muted-foreground mt-2">No API keys yet</p>
              <p className="font-sans text-xs text-muted-foreground/60 mt-1">
                Create one above to get started.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
