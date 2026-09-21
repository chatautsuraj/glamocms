import { redirect } from "next/navigation";

export default function PhoneOrderRedirect() {
  redirect("/orders?new=phone");
}
