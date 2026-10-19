"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { ChannelBadge } from "@/components/channel-badge";
import { StatusBadge } from "@/components/status-badge";
import type { PosOrder } from "@/lib/api/types";
import { formatDateTime, formatNPR } from "@/lib/format";

const orderHref = (o: PosOrder) => `/orders/${encodeURIComponent(o.id)}`;

/**
 * Orders as a table on md+ and as two-line rows on phones. Columns drop in priority order
 * (shipment, cashier, payment) so the bill number, customer, status and total never scroll away.
 * `compact` keeps only those for narrow cards such as the dashboard.
 */
export function OrdersTable({ orders, showShipment = true, compact = false, emptyText = "No orders match these filters." }: { orders: PosOrder[]; showShipment?: boolean; compact?: boolean; emptyText?: string }) {
  const secondary = compact ? "hidden" : "hidden lg:table-cell";
  const tertiary = compact ? "hidden" : "hidden xl:table-cell";
  if (!orders.length) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <>
      <ul className="-mx-1 divide-y divide-border md:hidden" aria-label="Orders">
        {orders.map((o) => (
          <li key={o.id}>
            <Link
              href={orderHref(o)}
              className="flex min-h-16 items-center gap-3 rounded-lg px-1 py-3 transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{o.customer.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <span className="font-mono">{o.printableRef || o.orderNumber}</span>
                  <ChannelBadge channel={o.channel} />
                  {o.createdAt && <span className="whitespace-nowrap">{formatDateTime(o.createdAt)}</span>}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="tabular font-semibold">{formatNPR(o.totalAmount)}</span>
                <StatusBadge status={o.status} />
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full text-sm">
          <caption className="sr-only">Orders</caption>
          <thead className="text-left text-xs font-medium text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 pr-3 font-medium">Bill no.</th>
              <th scope="col" className="py-2 pr-3 font-medium">Customer</th>
              <th scope="col" className="py-2 pr-3 font-medium">Channel</th>
              <th scope="col" className={`${tertiary} py-2 pr-3 font-medium`}>Cashier</th>
              <th scope="col" className="py-2 pr-3 font-medium">Status</th>
              <th scope="col" className={`${secondary} py-2 pr-3 font-medium`}>Payment</th>
              {showShipment && <th scope="col" className={`${tertiary} py-2 pr-3 font-medium`}>Shipment</th>}
              <th scope="col" className="py-2 pr-3 text-right font-medium">Total</th>
              <th scope="col" className="py-2 text-right font-medium">When</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                <td className="whitespace-nowrap py-2.5 pr-3">
                  <Link href={orderHref(o)} className="font-mono text-xs font-medium text-primary underline-offset-4 hover:underline">
                    {o.printableRef || o.orderNumber}
                  </Link>
                </td>
                <td className="max-w-[220px] py-2.5 pr-3">
                  <span className="block truncate">{o.customer.name}</span>
                  {o.customer.phone && <span className="tabular text-xs text-muted-foreground">{o.customer.phone}</span>}
                </td>
                <td className="py-2.5 pr-3"><ChannelBadge channel={o.channel} /></td>
                <td className={`${tertiary} whitespace-nowrap py-2.5 pr-3 text-xs`}>{o.cashier?.name ?? "Website"}</td>
                <td className="py-2.5 pr-3"><StatusBadge status={o.status} /></td>
                <td className={`${secondary} py-2.5 pr-3`}><StatusBadge status={o.paymentStatus} /></td>
                {showShipment && (
                  <td className={`${tertiary} py-2.5 pr-3 text-xs`}>
                    {o.shipment ? <><StatusBadge status={o.shipment.status} />{o.shipment.trackingCode && <span className="ml-1 font-mono">{o.shipment.trackingCode}</span>}</> : <span className="text-muted-foreground">—</span>}
                  </td>
                )}
                <td className="tabular whitespace-nowrap py-2.5 pr-3 text-right font-semibold">{formatNPR(o.totalAmount)}</td>
                <td className="whitespace-nowrap py-2.5 text-right text-xs text-muted-foreground">{o.createdAt ? formatDateTime(o.createdAt) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
