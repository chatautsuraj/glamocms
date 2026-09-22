"use client";

import { useState } from "react";
import Image from "next/image";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

function isInlineImageSrc(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

export function ProductPhoto({ src, name, className, sizes = "240px" }: { src?: string; name: string; className?: string; sizes?: string }) {
  const [failed, setFailed] = useState<string | undefined>();
  const show = Boolean(src && src !== failed);

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-white", className)}>
      {show && src ? (
        isInlineImageSrc(src) ? (
          // eslint-disable-next-line @next/next/no-img-element -- data/blob URLs from product upload
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-contain p-3"
            onError={() => setFailed(src)}
          />
        ) : (
          <Image
            src={src}
            alt={name}
            fill
            sizes={sizes}
            unoptimized
            loading="lazy"
            className="object-contain p-3"
            onError={() => setFailed(src)}
          />
        )
      ) : (
        <div className="flex h-full min-h-12 items-center justify-center bg-muted">
          <Package className="h-8 w-8 text-muted-foreground" aria-label="No product photo" />
        </div>
      )}
    </div>
  );
}
