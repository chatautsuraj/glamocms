"use client";

import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { commerceClient } from "@/lib/commerce-client";
import { formatNPR } from "@/lib/format";

type MarginReport = {
  days: number;
  totals: { revenue: number; cost: number; margin: number; qty: number };
  rows: Array<{
    sku: string;
    name: string;
    qty: number;
    revenue: number;
    cost: number;
    margin: number;
  }>;
};

type CashierReport = {
  days: number;
  shifts: Array<{
    id: string;
    cashierName: string;
    status: string;
    openingFloat: number;
    closingCash: number | null;
    expectedCash: number | null;
    variance: number | null;
    openedAt: string;
  }>;
  daily: Array<{ date: string; count: number; amount: number; paid: number }>;
};

export default function ReportsPage() {
  const [days, setDays] = useState(30);
  const [margin, setMargin] = useState<MarginReport | null>(null);
  const [cashier, setCashier] = useState<CashierReport | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [m, c] = await Promise.all([
        commerceClient.retailReport("margin", days),
        commerceClient.retailReport("cashier", days),
      ]);
      setMargin(m.report as MarginReport);
      setCashier(c.report as CashierReport);
    } catch {
      setMargin(null);
      setCashier(null);
    } finally {
      setBusy(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports"
        description="Margin by SKU and cashier / till reconciliation"
        actions={
          <div className="flex items-center gap-2">
            <select
              className="h-9 rounded-md border px-2 text-sm"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
            <Button variant="secondary" disabled={busy} onClick={() => void load()}>
              Refresh
            </Button>
          </div>
        }
      />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Margin by product</h2>
        {margin ? (
          <>
            <p className="text-sm text-muted-foreground">
              Revenue {formatNPR(margin.totals.revenue)} · Cost{" "}
              {formatNPR(margin.totals.cost)} · Margin {formatNPR(margin.totals.margin)}
            </p>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">SKU</th>
                    <th className="p-3">Product</th>
                    <th className="p-3 text-right">Qty</th>
                    <th className="p-3 text-right">Revenue</th>
                    <th className="p-3 text-right">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {margin.rows.slice(0, 50).map((r) => (
                    <tr key={r.sku} className="border-t">
                      <td className="p-3 font-mono text-xs">{r.sku}</td>
                      <td className="p-3">{r.name}</td>
                      <td className="p-3 text-right">{r.qty}</td>
                      <td className="p-3 text-right">{formatNPR(r.revenue)}</td>
                      <td className="p-3 text-right">{formatNPR(r.margin)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No margin rows yet — sell and receive stock (costs) to populate. Works offline on this browser.
          </p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Cashier / till</h2>
        {cashier ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Cashier</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody>
                  {cashier.shifts.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="p-3">{s.cashierName}</td>
                      <td className="p-3">{s.status}</td>
                      <td className="p-3 text-right">
                        {s.variance != null ? formatNPR(s.variance) : "—"}
                      </td>
                    </tr>
                  ))}
                  {!cashier.shifts.length && (
                    <tr>
                      <td colSpan={3} className="p-4 text-muted-foreground text-center">
                        No shifts in period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3 text-right">Tickets</th>
                    <th className="p-3 text-right">Sales</th>
                    <th className="p-3 text-right">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {cashier.daily.map((d) => (
                    <tr key={d.date} className="border-t">
                      <td className="p-3">{d.date}</td>
                      <td className="p-3 text-right">{d.count}</td>
                      <td className="p-3 text-right">{formatNPR(d.amount)}</td>
                      <td className="p-3 text-right">{formatNPR(d.paid)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No cashier data yet — open a till shift to start.</p>
        )}
      </section>
    </div>
  );
}
