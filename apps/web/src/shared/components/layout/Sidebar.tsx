import { Link } from "@tanstack/react-router";
import { Home, Folder, Server, FileText, BarChart3, Settings } from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Projects", href: "/projects", icon: Folder },
  { name: "Services", href: "/services", icon: Server },
  { name: "Logs", href: "/logs", icon: FileText },
  { name: "Metrics", href: "/metrics", icon: BarChart3 },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar() {
  return (
    <div className="flex w-64 flex-col bg-card border-r border-border">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
          F
        </div>
        <span className="text-xl font-bold">Forge</span>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navigation.map((item) => (
          <Link
            key={item.name}
            to={item.href}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-accent [&.active]:text-accent-foreground"
            activeProps={{
              className: "bg-accent text-accent-foreground",
            }}
          >
            <item.icon className="h-5 w-5" />
            {item.name}
          </Link>
        ))}
      </nav>

      <div className="border-t border-border p-4">
        <div className="text-xs text-muted-foreground">Forge v0.1.0</div>
      </div>
    </div>
  );
}
