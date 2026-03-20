import { Link } from "@tanstack/react-router";
import { Home, Folder, Server, FileText, BarChart3, Settings, Package } from "lucide-react";
import { JSX } from "react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Projects", href: "/projects", icon: Folder },
  { name: "Services", href: "/services", icon: Server },
  { name: "Images", href: "/images", icon: Package },
  { name: "Logs", href: "/logs", icon: FileText },
  { name: "Metrics", href: "/metrics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar(): JSX.Element {
  return (
    <aside className="flex w-64 flex-col bg-card border-r border-border">
      {/* Bold typographic header */}
      <div className="h-20 flex items-end px-5 pb-3 border-b border-border/50">
        <h1 className="font-['Space_Grotesk'] text-4xl font-bold tracking-tight text-foreground">
          F
        </h1>
        <div className="mb-1.5 ml-1.5 flex flex-col">
          <span className="font-['Space_Grotesk'] text-sm font-semibold tracking-wide text-foreground/90">
            orge
          </span>
          <span className="font-['JetBrains_Mono'] text-[9px] tracking-[0.25em] text-primary uppercase">
            Platform
          </span>
        </div>
      </div>

      {/* Navigation with vertical rhythm */}
      <nav className="flex-1 px-4 py-8">
        <div className="space-y-6">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              className="group relative flex items-center gap-4 py-1"
              activeProps={{
                className: "active",
              }}
            >
              {/* Large section number - distinctive editorial element */}
              <span className="font-['JetBrains_Mono'] text-[10px] text-muted-foreground/40 w-5 tabular-nums group-[.active]:text-primary">
                {(navigation.indexOf(item) + 1).toString().padStart(2, "0")}
              </span>

              {/* Icon with distinctive treatment */}
              <div className="relative">
                <item.icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground group-[.active]:text-primary" />
                <div className="absolute inset-0 bg-primary/0 blur-md transition-colors group-hover:bg-primary/10 group-[.active]:bg-primary/20" />
              </div>

              <span className="font-['Source_Code_Pro'] text-sm tracking-wide text-muted-foreground transition-colors group-hover:text-foreground group-[.active]:text-primary group-[.active]:font-bold">
                {item.name}
              </span>

              {/* Active indicator - left edge treatment */}
              <div className="absolute -left-4 top-0 bottom-0 w-0.5 bg-primary/0 transition-all group-[.active]:bg-primary" />
            </Link>
          ))}
        </div>
      </nav>

      {/* Footer with distinctive treatment */}
      <div className="border-t border-border/50 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="font-['JetBrains_Mono'] text-[9px] tracking-widest text-muted-foreground/60 uppercase">
              Status
            </span>
            <span className="font-['Source_Code_Pro'] text-xs text-foreground/80">Operational</span>
          </div>
          <div className="text-right">
            <span className="font-['JetBrains_Mono'] text-[10px] text-muted-foreground/40">
              v0.1.0
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
