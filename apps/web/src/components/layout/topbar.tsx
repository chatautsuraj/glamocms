"use client";

import { Building2, LogOut, Moon, Menu, Sun, User } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/providers/auth-provider";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { useStoreUser } from "@/lib/use-entitlements";
import { roleDisplayLabel } from "@/lib/features";
import { useRouter } from "next/navigation";

export function Topbar({ onMenuToggle, mobileOpen }: { onMenuToggle?: () => void; mobileOpen?: boolean }) {
  const { user, logout } = useAuth();
  const storeUser = useStoreUser();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur-md md:gap-4 md:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        aria-label="Open navigation"
        aria-expanded={mobileOpen}
        onClick={onMenuToggle}
      >
        <Menu className="h-5 w-5" />
      </Button>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Building2 className="hidden h-4 w-4 text-primary sm:block" />
        <p className="truncate font-display text-base font-semibold tracking-tight">Glamo Nepal</p>
        <span className="hidden text-xs text-muted-foreground sm:inline">· Store desk</span>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Toggle colour theme"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        >
          <Sun className="h-[18px] w-[18px] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-[18px] w-[18px] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
        </Button>

        <DropdownMenu
          trigger={
            <button
              type="button"
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors hover:bg-accent"
            >
              <Avatar initials={user?.avatar ?? "G"} size="sm" />
              <span className="hidden text-sm font-medium sm:inline">{user?.name}</span>
            </button>
          }
        >
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs text-muted-foreground">{user?.email}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {roleDisplayLabel(storeUser?.role ?? user?.role)} · Glamo Nepal
            </p>
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/dashboard")}>
            <User className="mr-2 h-4 w-4" /> Dashboard
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" /> Sign out
          </DropdownMenuItem>
        </DropdownMenu>
      </div>
    </header>
  );
}
