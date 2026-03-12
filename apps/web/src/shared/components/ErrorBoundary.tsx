import React, { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import {
  AlertTriangleIcon,
  ChevronDownIcon,
  CopyIcon,
  RefreshCwIcon,
  HomeIcon,
  XIcon,
} from "lucide-react";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorDisplayProps {
  error?: Error;
  onRetry: () => void;
}

function ErrorDisplay({ error, onRetry }: ErrorDisplayProps): React.ReactElement {
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);

  const errorMessage = error?.message || "An unexpected error occurred";
  const errorStack = error?.stack;
  const errorName = error?.name || "Error";

  const handleCopyError = (): void => {
    if (error) {
      const text = `${errorName}: ${errorMessage}\n\n${errorStack || ""}`;
      void navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleReload = (): void => {
    window.location.reload();
  };

  const handleGoHome = (): void => {
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background font-mono">
      {/* Top status bar - terminal inspired */}
      <div className="border-b border-border">
        <div className="flex items-center justify-between px-4 py-2 text-xs">
          <div className="flex items-center gap-3">
            <span className="text-destructive flex items-center gap-1.5">
              <span className="inline-block size-2 animate-pulse rounded-full bg-destructive" />
              CRASH
            </span>
            <span className="text-muted-foreground">{errorName}</span>
          </div>
          <button
            type="button"
            onClick={handleGoHome}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label="Go home"
          >
            <XIcon className="size-4" />
          </button>
        </div>
      </div>

      {/* Main content - asymmetric layout */}
      <div className="grid lg:grid-cols-[1fr_minmax(auto,900px)_1fr]">
        <div className="hidden lg:block" />
        <div className="relative flex min-h-[calc(100vh-41px)] flex-col p-6 lg:px-12 lg:py-16">
          {/* Error indicator - large monospace */}
          <div className="mb-8">
            <div
              className="inline-flex items-center justify-center rounded-lg bg-destructive/10 px-3 py-1.5 text-sm text-destructive"
              style={{ letterSpacing: "0.1em" }}
            >
              <AlertTriangleIcon className="mr-2 size-4" />
              EXCEPTION
            </div>
          </div>

          {/* Large error code - positioned near bottom */}
          <div
            className="absolute bottom-20 right-12 text-[12rem] md:text-[20rem] font-bold leading-none opacity-[0.06] pointer-events-none select-none"
            style={{ letterSpacing: "-0.08em" }}
          >
            500
          </div>

          {/* Title - type-driven, left-aligned */}
          <h1 className="mb-3 text-3xl font-semibold tracking-tight text-foreground lg:text-4xl">
            Application crashed
          </h1>

          {/* Error message - with visual breathing room */}
          <p className="mb-8 max-w-md text-base text-muted-foreground leading-relaxed">
            {errorMessage}
          </p>

          {/* Divider */}
          <div className="mb-8 h-px w-20 bg-border" />

          {/* Actions - not centered, clear hierarchy */}
          <div className="mb-10 flex flex-wrap items-center gap-3">
            <Button onClick={handleReload} variant="default" size="sm">
              <RefreshCwIcon className="mr-2 size-4" />
              Reload
            </Button>
            <Button onClick={onRetry} variant="outline" size="sm">
              Try again
            </Button>
            <Button onClick={handleGoHome} variant="ghost" size="sm">
              <HomeIcon className="mr-2 size-4" />
              Home
            </Button>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Expandable stack trace */}
          {errorStack && (
            <div className="mt-auto">
              <button
                type="button"
                onClick={() => setShowDetails(!showDetails)}
                className="group flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                <ChevronDownIcon
                  className="size-4 transition-transform duration-200 ease-out"
                  style={{ transform: showDetails ? "rotate(180deg)" : "rotate(0deg)" }}
                />
                <span className="group-hover:underline">
                  {showDetails ? "Hide" : "Show"} stack trace
                </span>
              </button>

              <div
                className="overflow-hidden"
                style={{
                  display: "grid",
                  gridTemplateRows: showDetails ? "1fr" : "0fr",
                  transition: "grid-template-rows 0.25s ease-out",
                }}
              >
                <div className="overflow-hidden">
                  <div className="mt-4 rounded-lg bg-muted border p-4">
                    <pre className="mb-4 overflow-x-auto text-xs text-muted-foreground leading-relaxed">
                      {errorStack}
                    </pre>
                    <Button
                      onClick={handleCopyError}
                      variant="outline"
                      size="xs"
                      className="w-full sm:w-auto"
                    >
                      <CopyIcon className="mr-2 size-3" />
                      {copied ? "Copied!" : "Copy to clipboard"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Footer - subtle brand element */}
          <div className="mt-8 flex items-center justify-between text-xs text-muted-foreground/60">
            <span>Forge Platform</span>
            <span className="font-mono">Error Boundary v1.0</span>
          </div>
        </div>
        <div className="hidden lg:block" />
      </div>
    </div>
  );
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error("Error caught by boundary:", error, errorInfo);

    // TODO: Send to error tracking service (e.g., Sentry)
    // Sentry.captureException(error, {
    //   contexts: { react: { componentStack: errorInfo.componentStack } }
    // });
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <ErrorDisplay
          error={this.state.error}
          onRetry={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }

    return this.props.children;
  }
}
