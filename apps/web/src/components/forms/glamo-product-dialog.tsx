"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { commerceClient, type ApiProduct } from "@/lib/commerce-client";
import { fileToProductImage } from "@/lib/image";
import { invalidateProductCache } from "@/lib/use-api-products";
import { toast } from "sonner";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: ApiProduct | null;
  onSaved: () => void;
};

export function GlamoProductDialog({ open, onOpenChange, edit, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [imageBusy, setImageBusy] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [mrp, setMrp] = useState("");
  const [stock, setStock] = useState("0");
  const [category, setCategory] = useState("");
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const [shade, setShade] = useState("");
  const [image, setImage] = useState("");
  const [reorderAt, setReorderAt] = useState("5");
  const [galla, setGalla] = useState(true);
  const [vatApplicable, setVatApplicable] = useState(false);
  const [isTester, setIsTester] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setName(edit.name);
      setSku(edit.sku);
      setPrice(String(edit.price));
      setMrp(String(edit.mrp ?? edit.price));
      setStock(String(edit.stock));
      setCategory(edit.category ?? "");
      setBrand(edit.brand ?? "");
      setSize(edit.size ?? "");
      setShade(edit.shade ?? "");
      setImage(edit.images?.[0] ?? "");
      setReorderAt(String(edit.reorderAt ?? 5));
      setGalla(edit.galla !== false);
      setVatApplicable(edit.vatApplicable === true);
      setIsTester(edit.isTester);
    } else {
      setName("");
      setSku("");
      setPrice("");
      setMrp("");
      setStock("0");
      setCategory("");
      setBrand("");
      setSize("");
      setShade("");
      setImage("");
      setReorderAt("5");
      setGalla(true);
      setVatApplicable(false);
      setIsTester(false);
    }
  }, [open, edit]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim(),
        price: Number(price),
        mrp: Number(mrp || price),
        stock: Number(stock) || 0,
        category: category.trim() || undefined,
        brand: brand.trim() || undefined,
        size: size.trim() || undefined,
        shade: shade.trim() || undefined,
        images: image.trim() ? [image.trim()] : [],
        reorderAt: Number(reorderAt) || 5,
        galla,
        vatApplicable,
        isTester,
      };
      if (edit) {
        await commerceClient.updateProduct(edit.id, payload);
        toast.success("Product updated · inventory synced");
      } else {
        await commerceClient.createProduct(payload);
        toast.success("Product created with opening stock · inventory synced");
      }
      invalidateProductCache();
      onOpenChange(false);
      onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-lg">
      <DialogContent className="relative max-h-[90vh] overflow-y-auto" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{edit ? "Edit product" : "Add product"}</DialogTitle>
          <DialogDescription>
            Opening stock is saved with the product and appears in Inventory immediately
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={submit}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div className="space-y-2 sm:w-36">
              <Label>Product image</Label>
              <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 sm:w-36">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local data URL / path preview
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="px-2 text-center text-xs text-muted-foreground">No image</span>
                )}
              </div>
              <div className="flex gap-1.5">
                <label className="flex-1 cursor-pointer">
                  <span className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-border bg-card px-2 text-xs font-medium hover:bg-muted">
                    {imageBusy ? "…" : image ? "Change" : "Add image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={imageBusy || loading}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (!file) return;
                      setImageBusy(true);
                      try {
                        const dataUrl = await fileToProductImage(file);
                        setImage(dataUrl);
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Could not add image");
                      } finally {
                        setImageBusy(false);
                      }
                    }}
                  />
                </label>
                {image ? (
                  <Button type="button" size="sm" variant="ghost" onClick={() => setImage("")}>
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} required disabled={!!edit} />
            </div>
            <div className="space-y-1">
              <Label>Brand</Label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Selling price</Label>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>MRP</Label>
              <Input type="number" min={0} value={mrp} onChange={(e) => setMrp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>{edit ? "Stock on hand" : "Opening stock"}</Label>
              <Input
                type="number"
                min={0}
                step={1}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1">
              <Label>Reorder at</Label>
              <Input type="number" min={0} value={reorderAt} onChange={(e) => setReorderAt(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Category</Label>
              <Input value={category} onChange={(e) => setCategory(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Size</Label>
              <Input value={size} onChange={(e) => setSize(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label>Shade</Label>
              <Input value={shade} onChange={(e) => setShade(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={galla} onChange={(e) => setGalla(e.target.checked)} />
              Show on POS counter
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={vatApplicable} onChange={(e) => setVatApplicable(e.target.checked)} />
              VAT applies (only if store VAT is on)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={isTester} onChange={(e) => setIsTester(e.target.checked)} />
              Tester (not for sale)
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : edit ? "Save" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
