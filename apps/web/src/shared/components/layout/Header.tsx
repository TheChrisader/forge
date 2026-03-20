import { Bell, Search, LogOut, Command } from "lucide-react";
import { useAuth } from "@/core/auth";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuItem,
} from "@/shared/components/ui/dropdown-menu";

export function Header(): React.ReactElement {
  const { user, logout } = useAuth();

  const userInitial = user?.userId?.charAt(0).toUpperCase() ?? "U";

  const handleLogout = (): void => {
    void logout();
  };

  return (
    <header className="flex h-20 items-end pb-4 justify-between border-b border-border/50 bg-card/80 backdrop-blur-sm shadow-sm px-5">
      {/* Search with distinctive treatment */}
      <div className="flex flex-1 items-center gap-3">
        <div className="relative flex w-md items-center">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
          <input
            type="text"
            placeholder="Search..."
            className="font-['Source_Code_Pro'] w-full border-0 border-b border-border/30 bg-transparent py-2 pl-9 pr-4 text-sm tracking-wide text-foreground placeholder:text-muted-foreground/40 focus:border-primary focus:outline-none transition-colors"
          />
          <kbd className="font-['JetBrains_Mono'] absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 rounded border border-border/40 px-1.5 py-0.5 text-[9px] text-muted-foreground/50">
            <Command className="h-2.5 w-2.5" />K
          </kbd>
        </div>
      </div>

      {/* Right side actions */}
      <div className="flex items-center gap-5">
        {/* Notification with editorial treatment */}
        <button className="group relative flex items-center gap-2 py-1 transition-colors hover:text-foreground">
          <div className="relative">
            <Bell className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />
            <span className="absolute -right-0.5 -top-0.5 flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
          </div>
          <span className="font-['JetBrains_Mono'] text-[9px] tracking-wider text-muted-foreground/60 group-hover:text-foreground/80">
            ALERTS
          </span>
        </button>

        <div className="h-4 w-px bg-border/30" />

        {/* User dropdown with refined treatment */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 rounded-sm py-1.5 px-2 transition-colors hover:bg-accent/50">
              <div className="flex flex-col items-end">
                <span className="font-['Source_Code_Pro'] text-sm font-medium leading-tight">
                  {user?.userId ?? "User"}
                </span>
                <span className="font-['JetBrains_Mono'] text-[9px] tracking-wider text-muted-foreground/60 uppercase">
                  {user?.role ?? "user"}
                </span>
              </div>
              <div className="h-9 w-9 rounded-sm bg-primary text-primary-foreground flex items-center justify-center font-['Space_Grotesk'] font-semibold text-sm">
                {userInitial}
              </div>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>
              <div className="flex flex-col space-y-0.5">
                <p className="font-['Source_Code_Pro'] text-sm font-medium">
                  {user?.userId ?? "User"}
                </p>
                <p className="font-['JetBrains_Mono'] text-[10px] tracking-wider text-muted-foreground/60 uppercase">
                  {user?.role ?? "user"}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="cursor-pointer text-destructive focus:text-destructive font-['Source_Code_Pro']"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
