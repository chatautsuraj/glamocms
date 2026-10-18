/** Bill print / PDF actions shared by the POS, phone orders and order details. */
import { toast } from "sonner";
import type { BillData } from "@/lib/api/types";
import { CHANNEL_LABEL } from "@/lib/labels";
import { billOptsFromBillData, downloadStoreBillPdf, printStoreBill } from "./bill";

const channelName = (bill: BillData) => CHANNEL_LABEL[bill.channel as keyof typeof CHANNEL_LABEL] ?? bill.channel;

export function printBill(bill: BillData) {
  try {
    if (!printStoreBill(billOptsFromBillData(bill, { channel: channelName(bill) }))) toast.error("Couldn't open the printer. Try again.");
  } catch {
    toast.error("Couldn't print the bill. Try again.");
  }
}

export function downloadBillPdf(bill: BillData) {
  try {
    downloadStoreBillPdf(billOptsFromBillData(bill, { channel: channelName(bill) }));
  } catch {
    toast.error("Couldn't create the PDF. Try again.");
  }
}
