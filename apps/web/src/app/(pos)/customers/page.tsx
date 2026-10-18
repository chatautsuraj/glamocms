"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { customersApi } from "@/lib/api/customers";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatNPR } from "@/lib/format";
import { useApi } from "@/lib/use-api";

export default function CustomersPage() {
  const router = useRouter();
  const canWrite = useAuthStore((s) => s.permissions.includes("customers.write"));
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useApi(() => customersApi.list({ q: query, page }), [query, page]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Look up customers, purchase history and khata (credit) balances."
        actions={canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New customer</Button>}
      />
      <Card>
        <CardContent className="space-y-3 p-4">
          <form className="relative max-w-md" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
            <label>
              <span className="sr-only">Search customers</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or email (Enter)" />
            </label>
          </form>
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Customers</caption>
                <thead className="text-left text-xs uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="py-2 pr-3">Phone</th><th scope="col" className="py-2 pr-3">Email</th>
                    <th scope="col" className="py-2 pr-3 text-right">Orders</th><th scope="col" className="py-2 text-right">Khata due</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((c) => (
                    <tr key={c.id} className="cursor-pointer border-b border-border/60 hover:bg-accent/40" onClick={() => router.push(`/customers/${encodeURIComponent(c.id)}`)}>
                      <td className="py-2 pr-3"><Link href={`/customers/${encodeURIComponent(c.id)}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                      <td className="py-2 pr-3">{c.phone ?? "—"}</td>
                      <td className="py-2 pr-3 text-muted-foreground">{c.email ?? "—"}</td>
                      <td className="py-2 pr-3 text-right">{c.orders ?? 0}</td>
                      <td className={`py-2 text-right ${(c.khataBalance ?? 0) > 0 ? "font-medium text-warning" : ""}`}>{formatNPR(c.khataBalance ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">No customers found.</p>}
            </div>
          )}
          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>
      <CustomerFormDialog open={open} onOpenChange={setOpen} customer={null} onSaved={(c) => router.push(`/customers/${encodeURIComponent(c.id)}`)} />
    </div>
  );
}
