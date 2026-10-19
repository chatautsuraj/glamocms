"use client";

import { useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadsApi } from "@/lib/api/uploads";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

const TYPES = ["image/jpeg", "image/png", "image/webp"];

/**
 * Image picker for settings (payment QR codes, logo): upload → POST
 * /pos/uploads/image, preview, remove. A link can be pasted instead.
 */
export function ImageUpload({ value, onChange, label, disabled, error, square = true }: { value: string; onChange: (url: string) => void; label: string; disabled?: boolean; error?: string; square?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [broken, setBroken] = useState<string | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    if (!TYPES.includes(file.type) || file.size > 5 * 1024 * 1024) {
      toast.error("Use a JPG, PNG or WebP image under 5 MB.");
      return;
    }
    setBusy(true);
    try {
      const { url } = await uploadsApi.image(file);
      setBroken(null);
      onChange(url);
      toast.success(`${label} uploaded. Press Save to keep it.`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };

  const showPreview = Boolean(value) && broken !== value;
  return (
    <div className="space-y-2">
      <span className="block text-sm font-medium">{label}</span>
      <div className="flex flex-wrap items-start gap-3">
        <div className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white", square ? "h-32 w-32" : "h-20 w-40")}>
          {showPreview ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded asset preview
            <img src={value} alt={`${label} preview`} className="h-full w-full object-contain p-1" onError={() => setBroken(value)} />
          ) : (
            <span className="px-2 text-center text-xs text-[#5e5650]">{value ? "Can't show this image" : "None yet"}</span>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <input ref={ref} type="file" accept={TYPES.join(",")} className="sr-only" onChange={(e) => void upload(e.target.files?.[0])} disabled={disabled || busy} tabIndex={-1} />
            <Button variant="outline" onClick={() => ref.current?.click()} disabled={disabled || busy}>
              <ImagePlus className="h-4 w-4" aria-hidden /> {busy ? "Uploading…" : value ? "Replace" : "Upload"}
            </Button>
            {value && (
              <Button variant="ghost" className="text-danger" onClick={() => onChange("")} disabled={disabled || busy}>
                <Trash2 className="h-4 w-4" aria-hidden /> Remove
              </Button>
            )}
          </div>
          <Input value={value} onChange={(e) => onChange(e.target.value.trim())} placeholder="or paste an https:// link" aria-label={`${label} link`} disabled={disabled} aria-invalid={Boolean(error)} className="h-10 text-xs" />
          {error && <span role="alert" className="text-xs font-medium text-danger">{error}</span>}
        </div>
      </div>
    </div>
  );
}
