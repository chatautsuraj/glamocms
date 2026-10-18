"use client";

import { LogOut, Menu, Moon, Sun, Wifi, WifiOff } from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { signOut } from "@/components/providers/auth-provider";
import { useAuthStore } from "@/lib/auth/auth-store";
import { useOfflineStore } from "@/lib/offline/sync-runner";

const ROLE_LABEL: Record<string, string> = {
  CASHIER: "Cashier", STAFF: "Cashier", MANAGER: "Manager", ADMIN: "Admin", SUPER_ADMIN: "Super admin", OWNER: "Owner",
};

export function Topbar({ onMenuToggle, mobileOpen }: { onMenuToggle?: () => void; mobileOpen?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const store = useAuthStore((s) => s.store);
  const online = useOfflineStore((s) => s.online);
  const { theme, setTheme } = useTheme();
  const initials = (user?.name || user?.email || "G").split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md md:gap-4 md:px-6">
      <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Open navigation" aria-expanded={mobileOpen} onClick={onMenuToggle}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="truncate font-display text-base font-semibold tracking-tight">{store?.name ?? "GLAMO Nepal"}</p>
        <span className="hidden truncate text-xs text-muted-foreground sm:inline">· {store?.address}</span>
      </div>
      <span
        role="status"
        className={online ? "hidden items-center gap-1 text-xs text-success sm:inline-flex" : "inline-flex items-center gap-1 rounded-lg bg-warning/10 px-2 py-1 text-xs font-medium text-warning"}
      >
        {online ? <Wifi className="h-3.5 w-3.5" aria-hidden /> : <WifiOff className="h-3.5 w-3.5" aria-hidden />}
        {online ? "Online" : "Offline"}
      </span>
      <Button variant="ghost" size="icon" className="relative" aria-label="Toggle colour theme" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
        <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      </Button>
      <DropdownMenu
        trigger={
          <button type="button" aria-label="Account menu" className="flex min-h-11 items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Avatar initials={initials} size="sm" />
            <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
          </button>
        }
      >
        <div className="px-3 py-2">
          <p className="text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-muted-foreground">{user?.email}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{ROLE_LABEL[user?.role ?? ""] ?? user?.role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem destructive onClick={() => void signOut()}>
          <LogOut className="mr-2 h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenu>
    </header>
  );
}
