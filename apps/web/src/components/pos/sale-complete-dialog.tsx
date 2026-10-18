"use client";

import { CheckCircle2, CloudOff, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import type { BillData } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { paymentTitle } from "@/lib/pos/payments";
import { downloadBillPdf, printBill } from "@/lib/print/print-sale";

/** After a sale: bill number, change to give, print / PDF, and "New sale" (Enter). */
export function SaleCompleteDialog({ bill, onClose }: { bill: BillData | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(bill)} onOpenChange={(o) => !o && onClose()} label="Sale complete" className="max-w-md">
      <DialogContent onClose={onClose}>
        {bill && (
          <div className="space-y-5 text-center">
            <div className="flex flex-col items-center gap-2 pt-2">
              {bill.provisional ? <CloudOff className="h-12 w-12 text-warning" aria-hidden /> : <CheckCircle2 className="h-12 w-12 text-success" aria-hidden />}
              <h2 className="text-xl font-semibold">{bill.provisional ? "Sale saved on this device" : "Sale complete"}</h2>
              <p className="text-sm text-muted-foreground">Bill number</p>
              <p className="tabular font-mono text-2xl font-bold tracking-wide">{bill.printableRef}</p>
              {bill.provisional && <p className="text-sm text-muted-foreground">No internet right now. The sale will be sent automatically when the connection is back.</p>}
            </div>
            <dl className="space-y-1 rounded-xl bg-muted p-4 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Total</dt><dd className="tabular font-semibold">{formatNPR(bill.total)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Paid by</dt><dd>{[...new Set(bill.payments.map((p) => paymentTitle(p.method)))].join(" + ") || "Cash on delivery"}</dd></div>
            </dl>
            {bill.change > 0 && (
              <div className="rounded-xl bg-success/10 px-4 py-3">
                <p className="text-sm font-semibold text-success">Give change</p>
                <p className="tabular font-display text-5xl font-bold text-success" aria-live="assertive">{formatNPR(bill.change)}</p>
              </div>
            )}
            {bill.due > 0 && <p className="text-lg font-semibold text-warning">To collect on delivery: {formatNPR(bill.due)}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="lg" onClick={() => printBill(bill)}><Printer className="h-4 w-4" aria-hidden /> Print bill</Button>
              <Button variant="outline" size="lg" onClick={() => downloadBillPdf(bill)}><Download className="h-4 w-4" aria-hidden /> Download PDF</Button>
            </div>
            <Button variant="brand" size="xl" className="w-full" onClick={onClose} autoFocus>New sale</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
