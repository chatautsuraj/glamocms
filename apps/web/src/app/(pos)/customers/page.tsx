"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { CustomerFormDialog } from "@/components/customer-form-dialog";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { SearchInput } from "@/components/search-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { customersApi } from "@/lib/api/customers";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatNumber } from "@/lib/format";
import { useApi } from "@/lib/use-api";
import { useDebounced } from "@/lib/use-debounced";

export default function CustomersPage() {
  const router = useRouter();
  const canWrite = useAuthStore((s) => s.permissions.includes("customers.write"));
  const [q, setQ] = useState("");
  const query = useDebounced(q.trim(), 300);
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [query]);
  const [open, setOpen] = useState(false);
  const { data, error, loading, reload } = useApi(() => customersApi.list({ q: query, page }), [query, page]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Customers"
        description="Find a customer by name or phone and see what they bought."
        actions={canWrite && <Button variant="brand" onClick={() => setOpen(true)}><Plus className="h-4 w-4" aria-hidden /> New customer</Button>}
      />
      <Card>
        <CardContent className="space-y-3 p-4">
          <SearchInput className="max-w-md" value={q} onChange={setQ} label="Search customers" placeholder="Name, phone or email" />
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Customers</caption>
                <thead className="text-left text-xs font-medium text-muted-foreground">
                  <tr className="border-b border-border">
                    <th scope="col" className="py-2 pr-3">Name</th><th scope="col" className="py-2 pr-3">Phone</th><th scope="col" className="hidden py-2 pr-3 sm:table-cell">Email</th>
                    <th scope="col" className="py-2 text-right">Orders</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.items ?? []).map((c) => (
                    <tr key={c.id} className="cursor-pointer border-b border-border/60 hover:bg-accent/40" onClick={() => router.push(`/customers/${encodeURIComponent(c.id)}`)}>
                      <td className="py-2 pr-3"><Link href={`/customers/${encodeURIComponent(c.id)}`} className="font-medium text-primary hover:underline">{c.name}</Link></td>
                      <td className="tabular py-2 pr-3">{c.phone ?? "—"}</td>
                      <td className="hidden py-2 pr-3 text-muted-foreground sm:table-cell">{c.email ?? "—"}</td>
                      <td className="tabular py-2 text-right">{formatNumber(c.orders ?? 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data?.items.length && <p className="py-8 text-center text-sm text-muted-foreground">{query ? "No customer matches that." : "No customers yet."}</p>}
            </div>
          )}
          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>
      <CustomerFormDialog open={open} onOpenChange={setOpen} customer={null} onSaved={(c) => router.push(`/customers/${encodeURIComponent(c.id)}`)} />
    </div>
  );
}
