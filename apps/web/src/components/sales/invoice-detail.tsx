"use client";

import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { StatusBadge } from "@/components/status-badge";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatNPR } from "@/lib/format";
import { useAppStore, type Invoice } from "@/lib/store";
import { useTenantInvoices } from "@/lib/use-tenant-data";
import { useCurrentTenant, useVatEnabled } from "@/lib/use-entitlements";
import { toast } from "sonner";
import { COMPANY } from "@/lib/mock-data";

export function InvoiceDetailDialog({
  invoice,
  open,
  onOpenChange,
}: {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const invoices = useTenantInvoices();
  const recordPayment = useAppStore((s) => s.recordPayment);
  const tenant = useCurrentTenant();
  const vatEnabled = useVatEnabled();
  const live = invoice ? invoices.find((i) => i.id === invoice.id) ?? invoice : null;
  const companyName = tenant?.name ?? COMPANY.name;

  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");

  useEffect(() => {
    if (live?.due) setPayAmount(String(live.due));
    else setPayAmount("");
  }, [live?.id, live?.due]);

  if (!live) return null;

  const items = live.items ?? [];
  const payments = live.payments ?? [];

  const handlePrint = () => {
    window.print();
  };

  const handlePayment = () => {
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid payment amount");
      return;
    }
    if (amount > live.due) {
      toast.error(`Amount cannot exceed due ${formatNPR(live.due)}`);
      return;
    }
    const updated = recordPayment(live.id, amount, payMethod);
    if (updated) {
      toast.success(`Payment of ${formatNPR(amount)} recorded`, {
        description: `Remaining due: ${formatNPR(updated.due)}`,
      });
      setPayAmount(updated.due > 0 ? String(updated.due) : "");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-2xl">
      <DialogContent className="relative max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible print:shadow-none print:border-0" onClose={() => onOpenChange(false)}>
        <div className="print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {live.number}
              <StatusBadge status={live.status} />
            </DialogTitle>
            <DialogDescription>
              {live.customer} · {formatDate(live.date)} · {live.method.replace(/_/g, " ")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div id="invoice-print" className="space-y-5">
          <div className="hidden print:block space-y-1 mb-6">
            <p className="text-lg font-bold">{companyName}</p>
            <p className="text-sm">{COMPANY.address}</p>
            <p className="text-sm">{vatEnabled ? `PAN/VAT: ${COMPANY.vat}` : `PAN: ${COMPANY.vat}`}</p>
            <p className="mt-4 text-xl font-semibold">
              {vatEnabled ? "Tax Invoice" : "Invoice"} {live.number}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 text-sm">
            <div>
              <p className="text-muted-foreground">Customer</p>
              <p className="font-medium">{live.customer}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Payment</p>
              <p className="font-medium">{live.method.replace(/_/g, " ")}</p>
              {live.method === "SPLIT" && (
                <p className="text-xs text-muted-foreground">
                  Cash {formatNPR(live.splitCash ?? 0)} · QR {formatNPR(live.splitQr ?? 0)}
                </p>
              )}
            </div>
            <div>
              <p className="text-muted-foreground">Due</p>
              <p className={`font-medium ${live.due > 0 ? "text-warning" : "text-success"}`}>
                {live.due > 0 ? formatNPR(live.due) : "Settled"}
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-3 py-2 font-medium">Item</th>
                  <th className="px-3 py-2 font-medium text-right">Qty</th>
                  <th className="px-3 py-2 font-medium text-right">Price</th>
                  <th className="px-3 py-2 font-medium text-right">Disc%</th>
                  <th className="px-3 py-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                      No line items on this invoice (legacy entry).
                    </td>
                  </tr>
                ) : (
                  items.map((item, idx) => (
                    <tr key={`${item.productId}-${idx}`} className="border-t border-border">
                      <td className="px-3 py-2">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.sku}</p>
                      </td>
                      <td className="px-3 py-2 text-right">{item.qty}</td>
                      <td className="px-3 py-2 text-right">{formatNPR(item.unitPrice)}</td>
                      <td className="px-3 py-2 text-right">{item.discountPercent ?? 0}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatNPR(item.lineTotal)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span>
              <span>{formatNPR(live.subtotal)}</span>
            </div>
            {vatEnabled && (
              <div className="flex justify-between text-muted-foreground">
                <span>VAT 13%</span>
                <span>{formatNPR(live.vat)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total</span>
              <span className="text-primary">{formatNPR(live.total)}</span>
            </div>
          </div>

          {payments.length > 0 && (
            <div className="space-y-2 print:break-inside-avoid">
              <p className="text-sm font-medium">Payment history</p>
              <div className="rounded-xl border border-border divide-y divide-border text-sm">
                {payments.map((p) => (
                  <div key={p.id} className="flex justify-between px-3 py-2">
                    <span>
                      {formatDate(p.date)} · {p.method.replace(/_/g, " ")}
                      {p.note ? ` · ${p.note}` : ""}
                    </span>
                    <span className="font-medium">{formatNPR(p.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator className="print:hidden" />

        <div className="flex flex-wrap gap-2 print:hidden">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
        </div>

        {live.due > 0 && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4 print:hidden">
            <p className="text-sm font-medium">Record payment</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1 sm:col-span-1">
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={1}
                  max={live.due}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1 sm:col-span-1">
                <Label>Method</Label>
                <Select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="QR_ESEWA">QR eSewa</option>
                  <option value="QR_KHALTI">QR Khalti</option>
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CHEQUE">Cheque</option>
                </Select>
              </div>
              <div className="flex items-end">
                <Button className="w-full" onClick={handlePayment}>
                  Collect {formatNPR(Number(payAmount) || 0)}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
