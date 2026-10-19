"use client";

import Link from "next/link";
import { ChannelBadge } from "@/components/channel-badge";
import { StatusBadge } from "@/components/status-badge";
import type { PosOrder } from "@/lib/api/types";
import { formatDateTime, formatNPR } from "@/lib/format";

export function OrdersTable({ orders, showShipment = true, emptyText = "No orders match these filters." }: { orders: PosOrder[]; showShipment?: boolean; emptyText?: string }) {
  if (!orders.length) return <p className="py-10 text-center text-sm text-muted-foreground">{emptyText}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="mobile-record-table w-full text-sm">
        <caption className="sr-only">Orders</caption>
        <thead className="text-left text-xs font-medium text-muted-foreground">
          <tr className="border-b border-border">
            <th scope="col" className="py-2 pr-3">Bill no.</th>
            <th scope="col" className="py-2 pr-3">Channel</th>
            <th scope="col" className="py-2 pr-3">Customer</th>
            <th scope="col" className="py-2 pr-3">Cashier</th>
            <th scope="col" className="py-2 pr-3">Status</th>
            <th scope="col" className="py-2 pr-3">Payment</th>
            {showShipment && <th scope="col" className="py-2 pr-3">Shipment</th>}
            <th scope="col" className="py-2 pr-3 text-right">Total</th>
            <th scope="col" className="py-2">When</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id} className="border-b border-border/60 hover:bg-accent/40">
              <td className="py-2 pr-3">
                <Link href={`/orders/${encodeURIComponent(o.id)}`} className="inline-flex min-h-11 items-center font-mono text-sm font-medium text-primary underline-offset-4 hover:underline">
                  {o.printableRef || o.orderNumber}
                </Link>
              </td>
              <td data-label="Channel" className="py-2 pr-3"><ChannelBadge channel={o.channel} /></td>
              <td data-label="Customer" className="py-2 pr-3">
                <span className="block max-w-[180px] break-words">{o.customer.name}</span>
                {o.customer.phone && <span className="text-xs text-muted-foreground">{o.customer.phone}</span>}
              </td>
              <td data-label="Cashier" className="py-2 pr-3 text-xs">{o.cashier?.name ?? "Website"}</td>
              <td data-label="Status" className="py-2 pr-3"><StatusBadge status={o.status} /></td>
              <td data-label="Payment" className="py-2 pr-3"><StatusBadge status={o.paymentStatus} /></td>
              {showShipment && (
                <td data-label="Shipment" className="py-2 pr-3 text-xs">
                  {o.shipment ? <><StatusBadge status={o.shipment.status} />{o.shipment.trackingCode && <span className="ml-1 font-mono">{o.shipment.trackingCode}</span>}</> : "—"}
                </td>
              )}
              <td data-label="Total" className="tabular py-2 pr-3 text-right font-semibold">{formatNPR(o.totalAmount)}</td>
              <td data-label="When" className="py-2 text-xs text-muted-foreground">{o.createdAt ? formatDateTime(o.createdAt) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
