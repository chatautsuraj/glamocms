"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductPhoto({ src, name, className, sizes = "240px" }: { src?: string; name: string; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState<string | undefined>();
  return <div className={cn("relative overflow-hidden rounded-xl bg-white", className)}>
    {src && src !== failed ? <Image src={src} alt={name} fill sizes={sizes} unoptimized className="object-contain p-3" onError={() => setFailed(src)} />
      : <div className="flex h-full min-h-12 items-center justify-center bg-muted"><Package className="h-8 w-8 text-muted-foreground" aria-label="No product photo" /></div>}
  </div>;
}
