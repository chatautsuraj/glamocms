import { redirect } from "next/navigation";

export default function BarcodesRedirect() {
  redirect("/inventory");
}
