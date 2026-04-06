import { JSX, useState } from "react";
import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";

interface DeploymentUrlProps {
  url: string;
}

export function DeploymentUrl({ url }: DeploymentUrlProps): JSX.Element {
  const [copied, setCopied] = useState(false);

  if (!url) {
    return <span className="text-xs font-mono text-white/30">No URL assigned</span>;
  }

  const handleCopy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard might not be available
    }
  };

  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="font-mono text-sm text-blue-400 hover:text-blue-300 transition-colors truncate max-w-75"
        title={url}
      >
        {url}
      </a>
      <button
        onClick={void handleCopy}
        className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
        title={copied ? "Copied!" : "Copy URL"}
      >
        {copied ? (
          <CheckIcon className="h-3.5 w-3.5 text-green-400" />
        ) : (
          <CopyIcon className="h-3.5 w-3.5" />
        )}
      </button>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="p-1 rounded hover:bg-white/10 transition-colors text-white/40 hover:text-white/70"
        title="Open in new tab"
      >
        <ExternalLinkIcon className="h-3.5 w-3.5" />
      </a>
    </div>
  );
}
