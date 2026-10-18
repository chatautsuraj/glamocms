"use client";

import { CheckCircle2, CloudOff, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { BillData } from "@/lib/api/types";
import { formatNPR } from "@/lib/format";
import { billOptsFromBillData, downloadStoreBillPdf, printStoreBill } from "@/lib/print-bill";
import { CHANNEL_LABEL } from "@/lib/labels";
import { toastError } from "@/lib/notify";

export function printBill(bill: BillData) {
  try {
    printStoreBill(billOptsFromBillData(bill, { channel: CHANNEL_LABEL[bill.channel as keyof typeof CHANNEL_LABEL] ?? bill.channel }));
  } catch (err) {
    toastError(err);
  }
}

export function SaleCompleteDialog({ bill, onClose }: { bill: BillData | null; onClose: () => void }) {
  return (
    <Dialog open={Boolean(bill)} onOpenChange={(o) => !o && onClose()} label="Sale complete" className="max-w-md">
      <DialogContent onClose={onClose}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {bill?.provisional ? <CloudOff className="h-5 w-5 text-warning" aria-hidden /> : <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />}
            {bill?.provisional ? "Sale saved offline" : "Sale complete"}
          </DialogTitle>
        </DialogHeader>
        {bill && (
          <div className="space-y-4 text-center">
            <p className="font-mono text-lg">{bill.printableRef}</p>
            {bill.provisional && <p className="text-sm text-muted-foreground">Provisional bill number — the sale will sync automatically when the connection is back.</p>}
            {bill.change > 0 && (
              <p className="text-3xl font-semibold text-success" aria-live="assertive">Change {formatNPR(bill.change)}</p>
            )}
            {bill.due > 0 && <p className="text-lg font-semibold text-warning">Due on delivery {formatNPR(bill.due)}</p>}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => printBill(bill)}><Printer className="h-4 w-4" /> Print again</Button>
              <Button variant="outline" onClick={() => { try { downloadStoreBillPdf(billOptsFromBillData(bill)); } catch (err) { toastError(err); } }}>
                <Download className="h-4 w-4" /> PDF
              </Button>
            </div>
            <Button size="lg" className="w-full" onClick={onClose} autoFocus>New sale</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
