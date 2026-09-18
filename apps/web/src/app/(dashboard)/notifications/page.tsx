"use client";

import { Bell, CheckCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { NOTIFICATIONS } from "@/lib/mock-data";
import { useTenantFiltered } from "@/lib/use-tenant-data";
import { cn } from "@/lib/utils";

const typeColors: Record<string, string> = {
  low_stock: "bg-warning/10 text-warning",
  overdue: "bg-danger/10 text-danger",
  credit: "bg-warning/10 text-warning",
  expiry: "bg-muted text-muted-foreground",
  order: "bg-primary/10 text-primary",
  visit: "bg-danger/10 text-danger",
};

export default function NotificationsPage() {
  const notifications = useTenantFiltered(NOTIFICATIONS);
  const unread = notifications.filter((n) => !n.read);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={`${unread.length} unread alerts`}
        actions={
          <Button variant="outline" size="sm">
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />

      <div className="space-y-3">
        {notifications.length === 0 && (
          <p className="rounded-xl border border-border bg-card px-5 py-8 text-center text-sm text-muted-foreground">
            No notifications for this workspace
          </p>
        )}
        {notifications.map((n) => (
          <Card
            key={n.id}
            className={cn(
              "transition-colors",
              !n.read && "border-primary/20 bg-primary/[0.02]"
            )}
          >
            <CardContent className="flex items-start gap-4 p-4">
              <div className={cn("rounded-xl p-2.5", typeColors[n.type] ?? "bg-muted")}>
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  {!n.read && <Badge variant="default" className="text-[10px]">New</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-2 text-xs text-muted-foreground">{n.time}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
