/**
 * Print actions used by the screens. The print builders (embedded logo,
 * jsbarcode, jsPDF) load on demand; preloadPrinting() fetches them in the
 * background so printing also works after the connection drops.
 */
import { toast } from "sonner";
import type { BillData, PosOrder, StoreProfile } from "@/lib/api/types";
import { CHANNEL_LABEL } from "@/lib/labels";
import { companyFromStore } from "./company";

const loadBill = () => import("./bill");
const loadPdf = () => import("./bill-pdf");
const loadDelivery = () => import("./delivery-note");

const channelName = (bill: BillData) => CHANNEL_LABEL[bill.channel as keyof typeof CHANNEL_LABEL] ?? bill.channel;

/** Warm the print modules (and the offline cache) while the screen is idle. */
export function preloadPrinting() {
  void loadBill().catch(() => undefined);
  void loadPdf().catch(() => undefined);
}

export async function printBill(bill: BillData) {
  try {
    const { billOptsFromBillData, printStoreBill } = await loadBill();
    if (!printStoreBill(billOptsFromBillData(bill, { channel: channelName(bill) }))) toast.error("Couldn't open the printer. Try again.");
  } catch {
    toast.error("Couldn't print the bill. Try again.");
  }
}

export async function downloadBillPdf(bill: BillData) {
  try {
    const [{ billOptsFromBillData }, { downloadStoreBillPdf }] = await Promise.all([loadBill(), loadPdf()]);
    downloadStoreBillPdf(billOptsFromBillData(bill, { channel: channelName(bill) }));
  } catch {
    toast.error("Couldn't create the PDF. Try again.");
  }
}

/** One A4 delivery note per order. */
export async function printDeliveryNotesFor(orders: PosOrder[], store: StoreProfile, rangeLabel?: string) {
  try {
    const { printDeliveryNotes } = await loadDelivery();
    if (!printDeliveryNotes({ orders, company: companyFromStore(store), rangeLabel })) toast.error("Nothing to print.");
  } catch {
    toast.error("Couldn't print the delivery notes. Try again.");
  }
}
