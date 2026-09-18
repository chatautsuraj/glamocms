"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Multi price-lists removed for Glamo — one selling price per product. */
export default function PricingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/products");
  }, [router]);
  return (
    <p className="p-6 text-sm text-muted-foreground">
      Price lists removed — use product selling price instead. Redirecting…
    </p>
  );
}
