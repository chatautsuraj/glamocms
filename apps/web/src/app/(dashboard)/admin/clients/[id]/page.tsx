"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Super admin client detail disabled for Glamo Nepal. */
export default function AdminClientPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);
  return (
    <p className="p-6 text-sm text-muted-foreground">Redirecting to Glamo desk…</p>
  );
}
