"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/lib/auth/auth-store";
import { homeFor } from "@/lib/auth/permissions";

export default function Home() {
  const router = useRouter();
  const status = useAuthStore((s) => s.status);
  const permissions = useAuthStore((s) => s.permissions);
  useEffect(() => {
    if (status === "ready") router.replace(homeFor(permissions));
    else if (status === "signedOut" || status === "denied") router.replace("/login");
  }, [status, permissions, router]);
  return <p className="p-8 text-sm text-muted-foreground" role="status">Loading GLAMO POS…</p>;
}
