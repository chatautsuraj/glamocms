"use client";

import { memo, useState } from "react";
import { cn } from "@/lib/utils";

/** First letters of the first two words: "Maybelline Fit Me" → "MF". */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter((w) => /[A-Za-z0-9]/.test(w));
  return (words.slice(0, 2).map((w) => w.replace(/[^A-Za-z0-9]/g, "")[0] ?? "").join("") || "G").toUpperCase();
}

const TINTS = ["bg-rose-tint", "bg-muted", "bg-[#f3ece4] dark:bg-[#2a231c]", "bg-[#ecefe9] dark:bg-[#1f2620]"];

function tintFor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

/**
 * Product photo with a monogram fallback: missing or failing images never show
 * a broken-image icon. Square, object-contain on white so mixed supplier
 * photos read as one grid.
 */
export const ProductImage = memo(function ProductImage({ src, name, className, rounded = "rounded-lg", sizes }: { src: string | null | undefined; name: string; className?: string; rounded?: string; sizes?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  const show = Boolean(src) && src !== failed;
  return (
    <div className={cn("relative overflow-hidden [container-type:inline-size]", rounded, show ? "bg-white" : tintFor(name), className)}>
      {show && src ? (
        // eslint-disable-next-line @next/next/no-img-element -- remote catalog photos (Cloudinary / Drive), images are unoptimised
        <img src={src} alt="" sizes={sizes} loading="lazy" decoding="async" draggable={false} onError={() => setFailed(src)} className="absolute inset-0 h-full w-full object-contain p-1.5" />
      ) : (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-[34cqw] font-semibold leading-none text-foreground/70">
          {monogram(name)}
        </span>
      )}
    </div>
  );
});
