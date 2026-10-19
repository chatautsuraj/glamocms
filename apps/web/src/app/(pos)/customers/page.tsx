"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronRight, Plus, SearchX, Users } from "lucide-react";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { SearchInput } from "@/components/search-input";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { customersApi, type CustomerFilter } from "@/lib/api/customers";
import type { Customer } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDate, formatNPR, formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-debounced";

const FILTERS: Array<{ key: CustomerFilter; label: string }> = [
  { key: "all", label: "Everyone" },
  { key: "repeat", label: "Repeat buyers" },
  { key: "new", label: "New (30 days)" },
  { key: "marketing", label: "Marketing opt-in" },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function isNewCustomer(createdAt: string | null): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return Number.isFinite(created) && Date.now() - created < 30 * 24 * 60 * 60 * 1000;
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: "rose" | "ink" }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-semibold tabular", tone === "rose" && "text-rose-dark")}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function CustomerRow({ c }: { c: Customer }) {
  const repeat = (c.orders ?? 0) > 1;
  const fresh = isNewCustomer(c.createdAt);
  return (
    <Link
      href={`/customers/${encodeURIComponent(c.id)}`}
      className="group flex min-h-16 items-center gap-3 rounded-xl px-2 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:px-3"
    >
      <Avatar initials={initials(c.name)} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{c.name}</span>
          {repeat && <Badge variant="brand">Repeat</Badge>}
          {fresh && <Badge variant="success">New</Badge>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {c.phone && <span className="tabular">{c.phone}</span>}
          {c.email && <span className="max-w-52 truncate">{c.email}</span>}
          {!c.phone && !c.email && <span>No contact details</span>}
          <span className="sm:hidden">
            {formatNumber(c.orders ?? 0)} orders · {formatNPR(c.totalSpent ?? 0)}
          </span>
        </div>
      </div>
      <div className="hidden w-28 shrink-0 text-right sm:block">
        <div className="text-sm font-semibold tabular">{formatNPR(c.totalSpent ?? 0)}</div>
        <div className="text-xs text-muted-foreground">{formatNumber(c.orders ?? 0)} orders</div>
      </div>
      <div className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground lg:block">
        {c.lastOrderAt ? `Last ${formatDate(c.lastOrderAt)}` : "Never ordered"}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}

export default function CustomersPage() {
  const router = useRouter();
  const canWrite = useAuthStore((s) => s.permissions.includes("customers.write"));
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const [filter, setFilter] = useState<CustomerFilter>("all");
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query, filter]);
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useApi(() => customersApi.list({ q: query, filter, page }), [query, filter, page]);
  const { data: stats } = useApi(() => customersApi.stats(), []);

  const items = data?.items ?? [];
  const filtered = filter !== "all" || query.length > 0;

  return (
    <div className="space-y-5">
      <PageHeader
        title="Customers"
        description="Every buyer, what they spend and when they last came back."
        actions={
          canWrite && (
            <Button variant="brand" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" aria-hidden /> New customer
            </Button>
          )
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Customers" value={formatNumber(stats?.total ?? 0)} hint="In the customer book" />
        <Stat label="Repeat buyers" value={formatNumber(stats?.repeat ?? 0)} hint="Two or more orders" tone="rose" />
        <Stat label="New" value={formatNumber(stats?.newCustomers ?? 0)} hint="Added in the last 30 days" />
        <Stat label="Marketing" value={formatNumber(stats?.marketing ?? 0)} hint="Opted in to campaigns" />
      </div>

      <Card>
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput className="w-full lg:max-w-sm" value={q} onChange={setQ} label="Search customers" placeholder="Name, phone or email" />
            <div className="flex flex-wrap gap-2" role="group" aria-label="Filter customers">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                  className={cn(
                    "min-h-9 rounded-full border px-3 text-sm font-medium transition-colors",
                    filter === f.key ? "border-rose-dark bg-rose-tint text-foreground" : "border-border text-muted-foreground hover:border-rose hover:text-foreground",
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <ErrorPanel error={error} onRetry={reload} />
          ) : loading && !data ? (
            <LoadingRows />
          ) : items.length ? (
            <div className="divide-y divide-border/60">
              {items.map((c) => (
                <CustomerRow key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-3 px-4 py-14 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-tint">
                {filtered ? <SearchX className="h-5 w-5 text-rose-dark" aria-hidden /> : <Users className="h-5 w-5 text-rose-dark" aria-hidden />}
              </span>
              <div>
                <p className="font-medium">{filtered ? "No customer matches" : "No customers yet"}</p>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {filtered
                    ? "Try a different spelling, a phone number, or clear the filter."
                    : "Add a customer at the till or create one here to start their history."}
                </p>
              </div>
              {filtered ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                canWrite && (
                  <Button variant="brand" onClick={() => setOpen(true)}>
                    <Plus className="h-4 w-4" aria-hidden /> New customer
                  </Button>
                )
              )}
            </div>
          )}

          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>

      <CustomerFormDialog open={open} onOpenChange={setOpen} customer={null} onSaved={(c) => router.push(`/customers/${encodeURIComponent(c.id)}`)} />
    </div>
  );
}
