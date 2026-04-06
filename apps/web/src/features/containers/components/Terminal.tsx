import { useEffect, useRef, useCallback } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { useTerminal, type TerminalStatus } from "@/core/api/hooks/useTerminal";
import { Button } from "@/shared/components/ui/button";
import { TerminalIcon, X, RotateCcw, Wifi, WifiOff, LoaderIcon } from "lucide-react";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
  containerId: string;
  containerName?: string;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  TerminalStatus,
  { label: string; icon: typeof Wifi; className: string }
> = {
  connecting: {
    label: "Connecting...",
    icon: LoaderIcon,
    className: "text-yellow-500",
  },
  connected: { label: "Connected", icon: Wifi, className: "text-green-500" },
  disconnected: {
    label: "Disconnected",
    icon: WifiOff,
    className: "text-red-500",
  },
  closed: { label: "Closed", icon: X, className: "text-muted-foreground" },
};

export function TerminalComponent({
  containerId,
  containerName,
  onClose,
}: TerminalProps): React.ReactElement {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const onDataRef = useRef<((data: string) => void) | null>(null);

  const handleTerminalData = useCallback((data: string) => {
    xtermRef.current?.write(data);
  }, []);

  const handleExit = useCallback((exitCode: number) => {
    xtermRef.current?.writeln(`\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m`);
  }, []);

  const handleError = useCallback((error: Error) => {
    xtermRef.current?.writeln(`\r\n\x1b[91m[Error: ${error.message}]\x1b[0m`);
  }, []);

  const { write, resize, close, status } = useTerminal({
    containerId,
    shell: "/bin/bash",
    rows: 24,
    cols: 80,
    onData: handleTerminalData,
    onExit: handleExit,
    onError: handleError,
  });

  useEffect(() => {
    if (!terminalRef.current) return;

    const xterm = new XTerm({
      cursorBlink: true,
      cursorStyle: "block",
      fontSize: 14,
      fontFamily: "'JetBrains Mono', monospace",
      theme: {
        background: "#0a0a0a",
        foreground: "#e5e5e5",
        cursor: "#e5e5e5",
        selectionBackground: "#264f78",
        black: "#0a0a0a",
        red: "#ff5f56",
        green: "#1bc47d",
        yellow: "#febc2e",
        blue: "#2472c8",
        magenta: "#a771bf",
        cyan: "#21c5c7",
        white: "#e5e5e5",
        brightBlack: "#6b6b6b",
        brightRed: "#ff8b86",
        brightGreen: "#50fa7b",
        brightYellow: "#f1fa8c",
        brightBlue: "#6bb8ff",
        brightMagenta: "#d6a5e0",
        brightCyan: "#8be9fd",
        brightWhite: "#ffffff",
      },
      allowTransparency: false,
      convertEol: false,
      scrollback: 5000,
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    xterm.loadAddon(fitAddon);
    xterm.loadAddon(webLinksAddon);

    xterm.open(terminalRef.current);

    try {
      fitAddon.fit();
    } catch {
      // Container may not be visible yet
    }

    xtermRef.current = xterm;
    fitAddonRef.current = fitAddon;

    xterm.onData((data) => {
      write(data);
    });

    return (): void => {
      xterm.dispose();
      xtermRef.current = null;
      fitAddonRef.current = null;
    };
  }, []);

  useEffect(() => {
    const container = terminalRef.current?.parentElement;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (fitAddonRef.current && xtermRef.current) {
        try {
          fitAddonRef.current.fit();
          const dims = xtermRef.current;
          resize(dims.rows, dims.cols);
        } catch {
          // Terminal may be disposed
        }
      }
    });

    observer.observe(container);

    return (): void => {
      observer.disconnect();
    };
  }, [resize]);

  useEffect(() => {
    onDataRef.current = handleTerminalData;
  }, [handleTerminalData]);

  const handleReconnect = useCallback(() => {
    // Okay, so we can't reconnect to the same shell
    // Force a re-render by using window.location.reload of the terminal
    // Since we can't truly reconnect to the same shell, we clear the terminal
    // and let the parent know it should create a new session
    xtermRef.current?.clear();
    xtermRef.current?.writeln("\x1b[90m[Reconnecting...]\x1b[0m");
    close();
    onClose();
  }, [close, onClose]);

  const statusInfo = STATUS_CONFIG[status];
  const StatusIcon = statusInfo.icon;

  return (
    <div className="flex h-full flex-col bg-[#0a0a0a]">
      <div className="flex items-center justify-between border-b border-white/10 bg-[#111] px-4 py-2">
        <div className="flex items-center gap-3">
          <TerminalIcon className="h-4 w-4 text-muted-foreground" />
          <span className="font-mono text-xs text-muted-foreground">
            {containerName || containerId.slice(0, 12)}
          </span>
          <div className={`flex items-center gap-1.5 ${statusInfo.className}`}>
            <StatusIcon className={`h-3 w-3 ${status === "connecting" ? "animate-spin" : ""}`} />
            <span className="font-mono text-[10px] uppercase tracking-wider">
              {statusInfo.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {status === "disconnected" && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
              onClick={handleReconnect}
            >
              <RotateCcw className="h-3 w-3" />
              <span className="font-sans text-xs">Reconnect</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-muted-foreground hover:text-foreground"
            onClick={onClose}
          >
            <X className="h-3 w-3" />
            <span className="font-sans text-xs">Close</span>
          </Button>
        </div>
      </div>

      <div ref={terminalRef} className="flex-1 p-1" />
    </div>
  );
}
