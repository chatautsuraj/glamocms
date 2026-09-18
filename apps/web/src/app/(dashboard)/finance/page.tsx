import { redirect } from "next/navigation";

/** Legacy Finance route — Expenses only. */
export default function FinanceRedirectPage() {
  redirect("/expenses");
}
