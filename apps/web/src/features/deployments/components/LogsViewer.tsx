import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Empty } from "@/shared/components/ui/empty";
import { EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { SearchIcon, ChevronDownIcon } from "lucide-react";

interface LogsViewerProps {
  logs: string;
  isLoading?: boolean;
}

// TODO Sprint 4: Replace polling with WebSocket connection
export function LogsViewer({ logs, isLoading = false }: LogsViewerProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const logLines = logs.split("\n");

  const filteredLogs = searchTerm
    ? logLines.filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
    : logLines;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const handleScrollToBottom = (): void => {
    setAutoScroll(true);
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  };

  const handleDownloadLogs = (): void => {
    const content = logs;
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isLoading && logLines.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No logs yet</EmptyTitle>
          <EmptyDescription>Logs will appear here once the deployment starts</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (isLoading && logLines.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading logs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadLogs}
          disabled={logLines.length === 0}
        >
          Download
        </Button>
      </div>

      {(searchTerm || filteredLogs.length !== logLines.length) && (
        <div className="border-b px-4 py-1 text-xs text-muted-foreground">
          {searchTerm
            ? `Showing ${filteredLogs.length} of ${logLines.length} lines`
            : `${logLines.length} lines`}
        </div>
      )}

      <div
        ref={scrollRef}
        className="flex-1 overflow-auto bg-muted/30 p-2 font-mono text-sm"
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No logs match your search</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredLogs.map((line, index) => (
              <div key={index} className="flex hover:bg-muted/50">
                <span className="select-none pr-4 text-muted-foreground">
                  {searchTerm ? logLines.indexOf(line) + 1 : index + 1}
                </span>
                <span className="flex-1 whitespace-pre-wrap wrap-break-word text-foreground">
                  {line || "\u00A0"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {!autoScroll && (
        <div className="border-t p-2">
          <Button variant="outline" size="sm" className="w-full" onClick={handleScrollToBottom}>
            <ChevronDownIcon />
            Back to bottom
          </Button>
        </div>
      )}
    </div>
  );
}
