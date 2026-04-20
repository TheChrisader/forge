import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Badge } from "@/shared/components/ui/badge";
import { SearchIcon, LoaderIcon, TerminalIcon } from "lucide-react";
import { useServiceLogs } from "@/core/api/hooks/useServices";

interface ServiceLogsViewerProps {
  serviceId: string;
}

export function ServiceLogsViewer({ serviceId }: ServiceLogsViewerProps): React.ReactElement {
  const [tailCount, setTailCount] = useState(500);
  const [follow, setFollow] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useServiceLogs(serviceId, tailCount);

  const lines = data?.data?.lines ?? [];

  const filteredLines = searchTerm
    ? lines.filter((line) => line.toLowerCase().includes(searchTerm.toLowerCase()))
    : lines;

  useEffect(() => {
    if (follow && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLines, follow]);

  return (
    <Card className="group transition-all hover:shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 font-serif">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
              <TerminalIcon className="h-4 w-4 text-primary" />
            </div>
            Logs
          </CardTitle>
          <div className="flex items-center gap-2">
            <div className="relative">
              <SearchIcon className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Filter logs..."
                className="pl-8 h-7 text-xs w-40 font-mono"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1">
              {[100, 500, 1000].map((count) => (
                <Button
                  key={count}
                  variant={tailCount === count ? "default" : "outline"}
                  size="xs"
                  className="font-mono text-[10px] px-2"
                  onClick={() => setTailCount(count)}
                >
                  {count}
                </Button>
              ))}
            </div>
            <Button
              variant={follow ? "default" : "outline"}
              size="sm"
              className="font-mono text-[10px] px-2"
              onClick={() => setFollow((v) => !v)}
            >
              {follow ? "Following" : "Paused"}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <LoaderIcon className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filteredLines.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="font-sans text-sm text-muted-foreground">
              {searchTerm ? "No logs match your filter" : "No logs available"}
            </p>
          </div>
        ) : (
          <div
            ref={scrollRef}
            className="h-100 overflow-y-auto rounded-md bg-zinc-950 dark:bg-zinc-900 p-3"
          >
            {filteredLines.map((line, i) => (
              <div key={i} className="flex">
                <span className="select-none text-zinc-600 mr-3 text-right shrink-0 w-8 font-mono text-[10px] leading-5">
                  {i + 1}
                </span>
                <pre className="font-mono text-xs text-zinc-300 leading-5 whitespace-pre-wrap break-all">
                  {searchTerm ? <HighlightedText text={line} highlight={searchTerm} /> : line}
                </pre>
              </div>
            ))}
          </div>
        )}
        {filteredLines.length > 0 && (
          <div className="flex items-center justify-between mt-2">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {filteredLines.length} lines
            </Badge>
            <Button
              variant="ghost"
              size="xs"
              className="font-mono text-[10px]"
              onClick={() => {
                if (scrollRef.current) {
                  scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
              }}
            >
              Scroll to bottom
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HighlightedText({
  text,
  highlight,
}: {
  text: string;
  highlight: string;
}): React.ReactElement {
  const parts = text.split(
    new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
  );

  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === highlight.toLowerCase() ? (
          <mark key={i} className="bg-yellow-500/30 text-yellow-200 rounded-sm px-0.5">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
