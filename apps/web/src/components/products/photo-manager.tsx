"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, ImagePlus, Link2, Star, Trash2 } from "lucide-react";
import { ProductImage } from "@/components/product-image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { catalogApi } from "@/lib/api/catalog";
import type { PosImage, PosProduct } from "@/lib/api/types";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";

export const MAX_PHOTOS = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Primary first, then sort order (same rule as the server). */
export function orderedImages(images: PosImage[]): PosImage[] {
  return [...images].sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

/**
 * Product photos: upload several at once, add by link, choose the main photo,
 * reorder and delete. Every change is saved straight away.
 */
export function PhotoManager({ product, onImages }: { product: PosProduct; onImages: (images: PosImage[]) => void }) {
  const images = orderedImages(product.images ?? []);
  const [progress, setProgress] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const room = MAX_PHOTOS - images.length;

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files);
    const bad = list.filter((f) => !TYPES.includes(f.type) || f.size > MAX_BYTES);
    if (bad.length) toast.error(`${bad.length === 1 ? bad[0].name : `${bad.length} files`}: use JPG, PNG or WebP under 5 MB.`);
    const good = list.filter((f) => !bad.includes(f)).slice(0, Math.max(0, room));
    if (list.length - bad.length > room) toast.warning(`Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} (10 per product).`);
    let done = 0;
    for (const file of good) {
      setProgress(`Uploading ${done + 1} of ${good.length}…`);
      try {
        const res = await catalogApi.uploadImage(product.id, file);
        onImages(res.images);
        done += 1;
      } catch (err) {
        toastError(err);
        break;
      }
    }
    setProgress(null);
    if (fileRef.current) fileRef.current.value = "";
    if (done) toast.success(done === 1 ? "Photo added" : `${done} photos added`);
  };

  const addUrl = async () => {
    const value = url.trim();
    if (!/^https:\/\/\S+$/i.test(value) && !value.startsWith("/images/")) return void toast.error("Paste a link that starts with https://");
    setProgress("Adding photo…");
    try {
      const res = await catalogApi.addImageUrl(product.id, value);
      onImages(res.images);
      setUrl("");
      toast.success("Photo added");
    } catch (err) {
      toastError(err);
    } finally {
      setProgress(null);
    }
  };

  const run = async (id: string, fn: () => Promise<PosImage[]>) => {
    setBusyId(id);
    try {
      onImages(await fn());
    } catch (err) {
      toastError(err);
    } finally {
      setBusyId(null);
    }
  };

  const makeMain = (img: PosImage) => run(img.id, async () => (await catalogApi.updateImage(product.id, img.id, { isPrimary: true })).images);

  /** Move a photo one place; renumbers sort orders so the order sticks. */
  const move = (index: number, delta: -1 | 1) =>
    run(images[index].id, async () => {
      const next = [...images];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      let latest = images;
      for (const [i, img] of next.entries()) {
        if (img.sortOrder !== i) latest = (await catalogApi.updateImage(product.id, img.id, { sortOrder: i })).images;
      }
      return latest;
    });

  const remove = (img: PosImage) => {
    if (!window.confirm("Delete this photo?")) return;
    void run(img.id, async () => (await catalogApi.deleteImage(product.id, img.id)).images);
  };

  return (
    <div className="space-y-4">
      {images.length ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.id} className={cn("overflow-hidden rounded-xl border bg-card", img.isPrimary ? "border-rose ring-1 ring-rose" : "border-border", busyId === img.id && "opacity-60")}>
              <div className="relative">
                <ProductImage src={img.url} name={product.name} rounded="rounded-none" className="aspect-square w-full" />
                {img.isPrimary && <span className="absolute left-2 top-2 rounded-full bg-brand px-2 py-0.5 text-xs font-semibold text-brand-foreground">Main photo</span>}
              </div>
              <div className="flex items-center justify-between gap-1 p-1.5">
                {img.isPrimary ? (
                  <span className="px-2 text-xs text-muted-foreground">Shown on tiles</span>
                ) : (
                  <Button size="sm" variant="ghost" onClick={() => void makeMain(img)} disabled={Boolean(busyId)}>
                    <Star className="h-3.5 w-3.5" aria-hidden /> Make main
                  </Button>
                )}
                <span className="flex">
                  {!img.isPrimary && (
                    <>
                      <Button size="icon-sm" variant="ghost" aria-label="Move left" onClick={() => void move(i, -1)} disabled={Boolean(busyId) || i <= 1}><ArrowLeft className="h-4 w-4" /></Button>
                      <Button size="icon-sm" variant="ghost" aria-label="Move right" onClick={() => void move(i, 1)} disabled={Boolean(busyId) || i >= images.length - 1}><ArrowRight className="h-4 w-4" /></Button>
                    </>
                  )}
                  <Button size="icon-sm" variant="ghost" className="text-danger" aria-label="Delete photo" onClick={() => remove(img)} disabled={Boolean(busyId)}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">No photos yet. Tiles show the product initials until you add one.</p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <input ref={fileRef} type="file" accept={TYPES.join(",")} multiple className="sr-only" id={`photos-${product.id}`} onChange={(e) => void upload(e.target.files)} disabled={room <= 0 || Boolean(progress)} />
        <Button variant="default" onClick={() => fileRef.current?.click()} disabled={room <= 0 || Boolean(progress)}>
          <ImagePlus className="h-4 w-4" aria-hidden /> Upload photos
        </Button>
        <span className="text-xs text-muted-foreground" role="status" aria-live="polite">{progress ?? `${images.length} of ${MAX_PHOTOS} · JPG, PNG or WebP, up to 5 MB each`}</span>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); void addUrl(); }}>
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">Photo link</span>
          <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Or paste a photo link (https://…)" className="pl-9" type="url" disabled={room <= 0} />
        </label>
        <Button type="submit" variant="outline" disabled={!url.trim() || room <= 0 || Boolean(progress)}>Add link</Button>
      </form>
    </div>
  );
}
