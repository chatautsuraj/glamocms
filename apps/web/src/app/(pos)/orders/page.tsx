"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { ChannelSwitcher } from "@/components/channel-switcher";
import { DateRangeControls, presetRange, type DayRange } from "@/components/date-range";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { OrdersTable } from "@/components/orders-table";
import { PageHeader } from "@/components/page-header";
import { Pager } from "@/components/pager";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ordersApi } from "@/lib/api/orders";
import { ORDER_STATUSES, type Channel, type OrderStatus } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { STATUS_LABEL } from "@/lib/labels";
import { useApi } from "@/lib/use-api";

export default function OrdersPage() {
  const readAll = useAuthStore((s) => s.permissions.includes("orders.read.all"));
  const [channel, setChannel] = useState<Channel | "">("");
  const [status, setStatus] = useState<OrderStatus | "">("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [range, setRange] = useState<DayRange>(presetRange("7d"));
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, error, loading, reload } = useApi(
    () => ordersApi.list({ channel, status, paymentStatus, from: readAll ? range.from : undefined, to: readAll ? range.to : undefined, q: query, page, limit: 25 }),
    [channel, status, paymentStatus, range.from, range.to, query, page, readAll],
  );

  const reset = <T,>(fn: (v: T) => void) => (v: T) => { fn(v); setPage(1); };

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" description={readAll ? "All sales and orders: counter, website, WhatsApp and phone." : "Your sales today."} />
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <ChannelSwitcher value={channel} onChange={reset(setChannel)} />
            <label className="w-44">
              <span className="sr-only">Status</span>
              <Select value={status} onChange={(e) => reset(setStatus)(e.target.value as OrderStatus | "")} aria-label="Status">
                <option value="">All statuses</option>
                {ORDER_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </Select>
            </label>
            <label className="w-40">
              <span className="sr-only">Payment status</span>
              <Select value={paymentStatus} onChange={(e) => reset(setPaymentStatus)(e.target.value)} aria-label="Payment status">
                <option value="">Any payment</option>
                <option value="PAID">Paid</option>
                <option value="PENDING">Pending / COD</option>
                <option value="REFUNDED">Refunded</option>
              </Select>
            </label>
            <form className="relative w-full min-w-0 flex-1 sm:min-w-[220px]" onSubmit={(e) => { e.preventDefault(); setQuery(q.trim()); setPage(1); }}>
              <label>
                <span className="sr-only">Search orders</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Bill no., order no., customer, phone… (Enter)" />
              </label>
            </form>
          </div>
          {readAll && <DateRangeControls value={range} onChange={reset(setRange)} />}
        </CardContent>
      </Card>
      <Card>
        <CardContent className="space-y-3 p-4">
          {error ? <ErrorPanel error={error} onRetry={reload} /> : loading && !data ? <LoadingRows /> : <OrdersTable orders={data?.items ?? []} />}
          {data && !data.items.length && (channel || status || paymentStatus || query) && <Button variant="outline" onClick={() => { setChannel(""); setStatus(""); setPaymentStatus(""); setQ(""); setQuery(""); setPage(1); }}>Clear filters</Button>}
          {data && <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />}
        </CardContent>
      </Card>
    </div>
  );
}
