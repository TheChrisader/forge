import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";
import { Empty } from "@/shared/components/ui/empty";
import { EmptyHeader, EmptyTitle, EmptyDescription } from "@/shared/components/ui/empty";
import { SearchIcon, ChevronDownIcon, WifiIcon, WifiOffIcon, LoaderIcon } from "lucide-react";

interface LogsViewerProps {
  logs: Array<{
    lineNumber: number;
    timestamp: string;
    level: string;
    source: string;
    message: string;
    progress?: number;
  }>;
  isLoading?: boolean;
  isConnected?: boolean;
  progress?: number;
  error?: Error | null;
}

export function LogsViewer({
  logs,
  isLoading = false,
  isConnected = false,
  progress,
  error,
}: LogsViewerProps): React.ReactElement {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredLogs = searchTerm
    ? logs.filter(
        (entry) =>
          entry.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
          entry.source.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : logs;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      });
    }
  }, [logs, autoScroll]);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>): void => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const handleScrollToBottom = (): void => {
    setAutoScroll(true);
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  };

  const handleDownloadLogs = (): void => {
    const content = logs
      .map((entry) => `[${entry.timestamp}] [${entry.level}] [${entry.source}] ${entry.message}`)
      .join("\n");
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `deployment-${Date.now()}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const getConnectionStatus = (): { icon: React.ReactNode; text: string; className: string } => {
    if (error) {
      return {
        icon: <WifiOffIcon className="h-3 w-3" />,
        text: "Connection error",
        className: "text-destructive",
      };
    }
    if (isConnected) {
      return {
        icon: <WifiIcon className="h-3 w-3" />,
        text: "Live",
        className: "text-green-500",
      };
    }
    return {
      icon: <LoaderIcon className="h-3 w-3 animate-spin" />,
      text: "Connecting...",
      className: "text-muted-foreground",
    };
  };

  if (!isLoading && logs.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No logs yet</EmptyTitle>
          <EmptyDescription>Logs will appear here once the deployment starts</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  if (isLoading && logs.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-muted-foreground">Loading logs...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      className="flex h-full flex-col relative overflow-y-auto"
      ref={scrollRef}
      onScroll={handleScroll}
    >
      <div className="flex sticky top-0 items-center gap-2 border-b px-4 py-2 bg-background">
        <div className={`flex items-center gap-1.5 text-xs ${getConnectionStatus().className}`}>
          {getConnectionStatus().icon}
          <span>{getConnectionStatus().text}</span>
        </div>

        {progress !== undefined && progress < 100 && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span>{progress}%</span>
          </div>
        )}

        <div className="flex-1" />

        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-64 pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownloadLogs}
          disabled={logs.length === 0}
        >
          Download
        </Button>
      </div>

      {(searchTerm || filteredLogs.length !== logs.length) && (
        <div className="border-b px-4 py-1 text-xs text-muted-foreground">
          {searchTerm
            ? `Showing ${filteredLogs.length} of ${logs.length} lines`
            : `${logs.length} lines`}
        </div>
      )}

      <div className="flex-1 bg-muted/30 p-2 font-mono text-sm">
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-muted-foreground">No logs match your search</p>
          </div>
        ) : (
          <div className="space-y-0">
            {filteredLogs.map((entry, index) => {
              const indexColumnSpacing = filteredLogs.length.toString().length / 1.75;
              return (
                <div
                  key={`${entry.lineNumber}-${entry.timestamp}`}
                  className="flex hover:bg-muted/50"
                >
                  <div
                    className="select-none text-muted-foreground relative"
                    style={{
                      paddingRight: `${indexColumnSpacing}rem`,
                    }}
                  >
                    <span className="absolute text-xs">
                      {searchTerm ? logs.indexOf(entry) + 1 : index + 1}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{entry.timestamp}</span>
                      <span className="text-xs text-muted-foreground">{entry.source}</span>
                    </div>
                    <div className="whitespace-pre-wrap wrap-break-word text-foreground font-mono">
                      {entry.message || "\u00A0"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!autoScroll && (
        <div className="p-2 sticky bottom-0">
          <Button variant="outline" size="sm" className="w-full" onClick={handleScrollToBottom}>
            <ChevronDownIcon />
            Back to bottom
          </Button>
        </div>
      )}
    </div>
  );
}
