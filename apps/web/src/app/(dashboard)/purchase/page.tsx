import { redirect } from "next/navigation";

export default function PurchaseRedirect() {
  redirect("/inventory?receive=1");
}
