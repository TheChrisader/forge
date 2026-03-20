import { useImages, useImageStats, useDeleteImage, usePruneDangling } from "@/core/api/hooks";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Button } from "@/shared/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/shared/components/ui/card";
import { Trash2, RefreshCw, AlertTriangle, PackageIcon } from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  const intervals: Record<string, number> = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };
  for (const [unit, secondsInUnit] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / secondsInUnit);
    if (interval >= 1) {
      return `${interval} ${unit}${interval > 1 ? "s" : ""} ago`;
    }
  }
  return "just now";
}

export function ImagesPage(): React.ReactElement {
  const { data: imagesData, isLoading: isLoadingImages } = useImages();
  const { data: stats } = useImageStats();
  const deleteMutation = useDeleteImage();
  const pruneMutation = usePruneDangling();

  const handleDelete = async (id: string): Promise<void> => {
    await deleteMutation.mutateAsync({ id });
  };

  const handlePrune = async (): Promise<void> => {
    await pruneMutation.mutateAsync();
  };

  if (isLoadingImages) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-2 text-muted-foreground">
          <RefreshCw className="size-4 animate-spin" />
          <span className="font-sans text-sm">Loading images...</span>
        </div>
      </div>
    );
  }

  const images = imagesData?.data ?? [];
  const pruneResult = pruneMutation.data;

  return (
    <div className="space-y-6">
      {/* Header Card with stats */}
      <Card className="group overflow-hidden transition-all hover:shadow-lg">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <PackageIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="font-serif">Docker Images</CardTitle>
                <CardDescription className="font-mono text-[10px] uppercase tracking-wider">
                  Container Image Registry
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono text-[9px]">
                {images.length}
              </Badge>
              <Button
                onClick={() => void handlePrune()}
                disabled={pruneMutation.isPending}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                {pruneMutation.isPending ? (
                  <RefreshCw className="size-4 animate-spin" />
                ) : (
                  <Trash2 className="size-4" />
                )}
                <span className="font-sans text-sm">Prune</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
              Total Storage
            </span>
            <span className="font-sans text-sm font-medium">
              {stats?.count ?? 0} images · {formatBytes(stats?.totalBytes ?? 0)}
            </span>
          </div>
          {pruneResult && (
            <div className="flex items-center gap-2 rounded-md bg-success-500/10 px-3 py-2">
              <AlertTriangle className="size-4 text-success-500" />
              <span className="font-sans text-sm text-success-500">
                Freed {formatBytes(pruneResult.reclaimedBytes)} · {pruneResult.deleted.length} image
                {pruneResult.deleted.length !== 1 ? "s" : ""} deleted
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Error states */}
      {deleteMutation.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <p className="font-sans text-sm text-destructive">{deleteMutation.error.message}</p>
          </CardContent>
        </Card>
      )}

      {pruneMutation.error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertTriangle className="size-4 text-destructive shrink-0" />
            <p className="font-sans text-sm text-destructive">{pruneMutation.error.message}</p>
          </CardContent>
        </Card>
      )}

      {/* Images Table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-b">
                <TableHead className="font-mono text-[10px] uppercase tracking-wider w-35">
                  Image ID
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider">
                  Tags
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider w-25">
                  Size
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider w-30">
                  Created
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-wider w-17.5 text-right">
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.map((img) => (
                <TableRow
                  key={img.id}
                  className="group hover:bg-muted/30 transition-colors cursor-default"
                >
                  <TableCell>
                    <code className="font-mono text-xs text-muted-foreground group-hover:text-foreground transition-colors">
                      {img.id.slice(7, 19)}
                    </code>
                  </TableCell>
                  <TableCell>
                    {img.repoTags && img.repoTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {img.repoTags.map((tag) => (
                          <Badge key={tag} variant="secondary" className="font-mono text-[9px]">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <span className="font-mono text-xs text-muted-foreground/60 italic">
                        &lt;none&gt;
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-sans text-sm">{formatBytes(img.size || 0)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">
                      {img.created ? formatTimeAgo(new Date(img.created)) : "N/A"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(img.id)}
                      disabled={deleteMutation.isPending}
                      className="opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {images.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <PackageIcon className="size-8 opacity-50" />
                      <span className="font-sans text-sm">No images found</span>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
