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
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/shared/components/ui/card";
import { Trash2, RefreshCw, AlertTriangle } from "lucide-react";

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
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  const images = imagesData?.data ?? [];
  const pruneResult = pruneMutation.data;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Docker Images</CardTitle>
          <CardAction>
            <Button
              onClick={void handlePrune}
              disabled={pruneMutation.isPending}
              variant="outline"
              size="sm"
            >
              {pruneMutation.isPending ? (
                <RefreshCw className="mr-2 size-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 size-4" />
              )}
              Prune Dangling
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Total: {stats?.count ?? 0} images, {formatBytes(stats?.totalBytes ?? 0)}
          </p>
          {pruneResult && (
            <p className="mt-2 text-sm text-green-600">
              Deleted {pruneResult.deleted.length} images, freed{" "}
              {formatBytes(pruneResult.reclaimedBytes)}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {images.map((img) => (
                <TableRow key={img.id}>
                  <TableCell>
                    <code className="text-xs">{img.id.slice(7, 19)}</code>
                  </TableCell>
                  <TableCell>
                    {(img.repoTags || []).join(", ") || (
                      <span className="text-muted-foreground italic">&lt;none&gt;</span>
                    )}
                  </TableCell>
                  <TableCell>{formatBytes(img.size || 0)}</TableCell>
                  <TableCell>
                    {img.created ? formatTimeAgo(new Date(img.created)) : "N/A"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void handleDelete(img.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {deleteMutation.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <p className="text-sm">Failed to delete image: {deleteMutation.error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {pruneMutation.error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-4" />
              <p className="text-sm">Failed to prune images: {pruneMutation.error.message}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
