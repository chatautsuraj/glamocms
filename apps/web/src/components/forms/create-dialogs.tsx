"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Eye, EyeOff, Minus, Plus, Search, Trash2 } from "lucide-react";
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
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { calcVatIfEnabled, formatNPR } from "@/lib/format";
import { fileToProductImage } from "@/lib/image";
import { calcLineTotal, resolveUnitPrice, useAppStore, type Customer, type Expense, type Invoice, type InvoiceLineItem, type Order, type Product, type PurchaseOrder, type Supplier } from "@/lib/store";
import {
  useTenantCategories,
  useTenantCustomers,
  useTenantPriceLists,
  useTenantProducts,
  useTenantSuppliers,
} from "@/lib/use-tenant-data";
import { useVatEnabled } from "@/lib/use-entitlements";
import { commerceClient } from "@/lib/commerce-client";
import { invalidateProductCache } from "@/lib/use-api-products";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { featureLabel, STORE_ACCESS_FEATURES, type FeatureKey } from "@/lib/features";
import { Badge } from "@/components/ui/badge";

type FieldError = Record<string, string>;

type DraftLine = {
  key: string;
  productId: string;
  qty: string;
  unitPrice: string;
  discountPercent: string;
};

type CatalogProduct = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  brand?: string;
  category: string;
  size?: string;
  tradePrice: number;
  stock: number;
  mrp: number;
};

function FormDialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  wide,
  xwide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  wide?: boolean;
  xwide?: boolean;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className={xwide ? "max-w-5xl" : wide ? "max-w-3xl" : undefined}
    >
      <DialogContent className="relative max-h-[90vh] overflow-y-auto" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-danger">{message}</p>;
}

function FormActions({
  onCancel,
  loading,
  label = "Create",
}: {
  onCancel: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
        Cancel
      </Button>
      <Button type="submit" disabled={loading}>
        {loading ? "Saving…" : label}
      </Button>
    </div>
  );
}

export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void | boolean | Promise<void | boolean>;
}) {
  const [loading, setLoading] = useState(false);
  return (
    <FormDialogShell open={open} onOpenChange={onOpenChange} title={title} description={description}>
      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try {
              const result = await onConfirm();
              if (result !== false) onOpenChange(false);
            } finally {
              setLoading(false);
            }
          }}
        >
          {loading ? "Deleting…" : confirmLabel}
        </Button>
      </div>
    </FormDialogShell>
  );
}

function LineItemsEditor({
  lines,
  products,
  onChange,
  error,
  customerId,
  invoiceDate,
  mode = "sales",
  toolbar,
}: {
  lines: DraftLine[];
  products: CatalogProduct[];
  onChange: (lines: DraftLine[]) => void;
  error?: string;
  customerId?: string;
  invoiceDate?: string;
  /** Purchase mode skips stock limits and defaults to trade price. */
  mode?: "sales" | "purchase";
  toolbar?: ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const priceLists = useAppStore((s) => s.priceLists);
  const priceListItems = useAppStore((s) => s.priceListItems);
  const specialPrices = useAppStore((s) => s.specialPrices);
  const isPurchase = mode === "purchase";

  const priceFor = (productId: string) => {
    if (isPurchase) {
      const p = products.find((x) => x.id === productId);
      return p?.tradePrice ?? 0;
    }
    return resolveUnitPrice({ productId, customerId, date: invoiceDate });
  };

  // Re-resolve defaults when customer/date changes — skip first mount so order/invoice drafts keep their prices.
  const priceContextKey = `${customerId ?? ""}|${invoiceDate ?? ""}`;
  const prevPriceContext = useRef<string | null>(null);
  useEffect(() => {
    if (prevPriceContext.current === null) {
      prevPriceContext.current = priceContextKey;
      return;
    }
    if (prevPriceContext.current === priceContextKey) return;
    prevPriceContext.current = priceContextKey;
    if (!lines.some((l) => l.productId)) return;
    onChange(
      lines.map((l) =>
        l.productId ? { ...l, unitPrice: String(priceFor(l.productId)) } : l
      )
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when customer/date context changes
  }, [priceContextKey, priceLists, priceListItems, specialPrices]);

  const categories = useMemo(() => {
    const set = new Set(products.map((p) => p.category).filter(Boolean));
    return ["All", ...Array.from(set).sort()];
  }, [products]);

  const catalog = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => (category === "All" ? true : p.category === category))
      .filter((p) => {
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.barcode || "").toLowerCase().includes(q) ||
          (p.brand || "").toLowerCase().includes(q) ||
          (p.size || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const brand = (a.brand || "").localeCompare(b.brand || "");
        if (brand !== 0) return brand;
        const size = (a.size || "").localeCompare(b.size || "", undefined, { numeric: true });
        if (size !== 0) return size;
        return a.name.localeCompare(b.name);
      });
  }, [products, category, search]);

  const selectedLines = lines.filter((l) => l.productId);

  const update = (key: string, patch: Partial<DraftLine>) => {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  };

  const addProduct = (product: CatalogProduct) => {
    if (!isPurchase && product.stock <= 0) {
      toast.error(`${product.name} is out of stock`);
      return;
    }
    const existing = lines.find((l) => l.productId === product.id);
    if (existing) {
      const nextQty = Number(existing.qty || 0) + 1;
      if (!isPurchase && nextQty > product.stock) {
        toast.error(`Only ${product.stock} in stock`);
        return;
      }
      update(existing.key, { qty: String(nextQty) });
      return;
    }
    onChange([
      ...selectedLines,
      {
        key: `${Date.now()}-${product.id}`,
        productId: product.id,
        qty: "1",
        unitPrice: String(priceFor(product.id)),
        discountPercent: "0",
      },
    ]);
  };

  const removeLine = (key: string) => {
    onChange(lines.filter((l) => l.key !== key));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label>Products</Label>
        {toolbar}
      </div>
      {!isPurchase && !customerId && (
        <p className="text-xs text-muted-foreground">Select a customer to apply their price list rates.</p>
      )}
      {isPurchase && (
        <p className="text-xs text-muted-foreground">Pick catalog products or create a new SKU. Enter the supplier cost for each purchase line.</p>
      )}
      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, SKU, barcode…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                  category === cat
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
          <div className="max-h-[320px] space-y-4 overflow-y-auto pr-1">
            {catalog.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No products match</p>
            ) : (
              Object.entries(
                catalog.reduce<Record<string, CatalogProduct[]>>((acc, p) => {
                  const key = p.category || "Other";
                  (acc[key] ??= []).push(p);
                  return acc;
                }, {})
              ).map(([cat, items]) => (
                <div key={cat} className="space-y-2">
                  {category === "All" && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{cat}</p>
                  )}
                  <div className="grid gap-2 sm:grid-cols-2">
                    {items.map((p) => {
                      const inCart = selectedLines.find((l) => l.productId === p.id);
                      const out = !isPurchase && p.stock <= 0;
                      const displayPrice = priceFor(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          disabled={out}
                          onClick={() => addProduct(p)}
                          className={cn(
                            "rounded-lg border border-border bg-background p-3 text-left transition-colors",
                            out
                              ? "cursor-not-allowed opacity-50"
                              : "hover:border-primary/40 hover:bg-muted/40",
                            inCart && "border-primary/50 bg-primary/5"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium leading-tight">{p.name}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground">
                                {[p.size, p.brand, p.sku].filter(Boolean).join(" · ")}
                              </p>
                            </div>
                            {inCart && (
                              <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                                ×{inCart.qty}
                              </span>
                            )}
                          </div>
                          <div className="mt-2 flex items-end justify-between gap-2 text-[11px]">
                            <div>
                              <p className="font-semibold text-foreground">{formatNPR(displayPrice)}</p>
                              <p className="text-muted-foreground">MRP {formatNPR(p.mrp)}</p>
                            </div>
                            <p className={cn(!isPurchase && p.stock <= 0 ? "text-danger" : "text-muted-foreground")}>
                              {!isPurchase && p.stock <= 0 ? "Out of stock" : `Stock ${p.stock}`}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex min-h-[280px] flex-col rounded-xl border border-border bg-muted/20">
          <div className="border-b border-border px-3 py-2">
            <p className="text-sm font-medium">Selected ({selectedLines.length})</p>
          </div>
          <div className="flex-1 space-y-0 overflow-y-auto">
            {selectedLines.length === 0 ? (
              <p className="px-3 py-10 text-center text-sm text-muted-foreground">
                Tap a product to add it
              </p>
            ) : (
              selectedLines.map((line) => {
                const product = products.find((p) => p.id === line.productId);
                const qty = Number(line.qty) || 0;
                const unitPrice = Number(line.unitPrice) || 0;
                const discountPercent = Number(line.discountPercent) || 0;
                const lineTotal = calcLineTotal(qty, unitPrice, discountPercent);
                const listPrice = product ? priceFor(product.id) : 0;
                return (
                  <div key={line.key} className="space-y-2 border-b border-border px-3 py-3 last:border-b-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{product?.name ?? "Product"}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {[product?.size, product?.sku].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-danger"
                        onClick={() => removeLine(line.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Qty</span>
                        <div className="flex items-center gap-0.5">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => update(line.key, { qty: String(Math.max(1, qty - 1)) })}
                          >
                            <Minus className="h-3 w-3" />
                          </Button>
                          <Input
                            type="number"
                            min={1}
                            value={line.qty}
                            onChange={(e) => update(line.key, { qty: e.target.value })}
                            className="h-8 px-1 text-center text-xs"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-sm"
                            onClick={() => {
                              if (!isPurchase) {
                                const max = product?.stock ?? Infinity;
                                if (qty + 1 > max) {
                                  toast.error(`Only ${product?.stock} in stock`);
                                  return;
                                }
                              }
                              update(line.key, { qty: String(qty + 1) });
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Price</span>
                        <Input
                          type="number"
                          min={0}
                          value={line.unitPrice}
                          onChange={(e) => update(line.key, { unitPrice: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <span className="text-[10px] text-muted-foreground">Disc %</span>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={line.discountPercent}
                          onChange={(e) => update(line.key, { discountPercent: e.target.value })}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-[11px] text-muted-foreground">
                      <span>
                        {isPurchase ? "Trade" : "List"} {formatNPR(listPrice)} · MRP {formatNPR(product?.mrp ?? 0)}
                      </span>
                      <span className="font-semibold text-foreground">{formatNPR(lineTotal)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      <ErrorText message={error} />
    </div>
  );
}

export function CreateCustomerDialog({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: Customer | null;
}) {
  const addCustomer = useAppStore((s) => s.addCustomer);
  const updateCustomer = useAppStore((s) => s.updateCustomer);
  const priceLists = useTenantPriceLists();
  const [errors, setErrors] = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "INDIVIDUAL",
    phone: "",
    area: "",
    creditLimit: "100000",
    priceListId: "",
  });

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setForm({
        name: edit.name,
        type: edit.type,
        phone: edit.phone,
        area: edit.area,
        creditLimit: String(edit.creditLimit),
        priceListId: edit.priceListId ?? "",
      });
    } else {
      setForm({ name: "", type: "INDIVIDUAL", phone: "", area: "", creditLimit: "100000", priceListId: "" });
    }
    setErrors({});
  }, [open, edit]);

  const reset = () => {
    setForm({ name: "", type: "INDIVIDUAL", phone: "", area: "", creditLimit: "100000", priceListId: "" });
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Customer name is required";
    if (!/^(97|98)\d{8}$/.test(form.phone.replace(/\s/g, "")) && !/^0\d{8,9}$/.test(form.phone.replace(/\s/g, ""))) {
      next.phone = "Enter a valid Nepal phone (e.g. 9841234567)";
    }
    if (!form.area.trim()) next.area = "Area is required";
    const credit = Number(form.creditLimit);
    if (!Number.isFinite(credit) || credit < 0) next.creditLimit = "Credit limit must be 0 or more";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      if (edit) {
        const updated = updateCustomer(edit.id, {
          name: form.name.trim(),
          type: form.type,
          phone: form.phone.trim(),
          area: form.area.trim(),
          creditLimit: credit,
          priceListId: form.priceListId || undefined,
        });
        if (!updated) throw new Error("Could not update customer");
        toast.success(`Customer ${updated.code} updated`, { description: updated.name });
      } else {
        const created = addCustomer({
          name: form.name.trim(),
          type: form.type,
          phone: form.phone.trim(),
          area: form.area.trim(),
          creditLimit: credit,
          priceListId: form.priceListId || undefined,
        });
        toast.success(`Customer ${created.code} created`, { description: created.name });
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save customer");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={edit ? "Edit Customer" : "Add Customer"}
      description={edit ? "Update customer details" : "Create a customer, salon, bridal studio or spa account"}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="cust-name">Name</Label>
          <Input
            id="cust-name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Aarati Shrestha"
            autoFocus
          />
          <ErrorText message={errors.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cust-type">Type</Label>
            <Select
              id="cust-type"
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            >
              <option value="INDIVIDUAL">Individual</option>
              <option value="SALON">Retailr</option>
              <option value="BRIDAL_STUDIO">Bridal studio</option>
              <option value="SPA">Spa</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-phone">Phone</Label>
            <Input
              id="cust-phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="9841234567"
            />
            <ErrorText message={errors.phone} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="cust-area">Area</Label>
            <Input
              id="cust-area"
              value={form.area}
              onChange={(e) => setForm((f) => ({ ...f, area: e.target.value }))}
              placeholder="Kathmandu / Lalitpur"
            />
            <ErrorText message={errors.area} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cust-credit">Credit Limit (NPR)</Label>
            <Input
              id="cust-credit"
              type="number"
              min={0}
              value={form.creditLimit}
              onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
            />
            <ErrorText message={errors.creditLimit} />
          </div>
        </div>
        <FormActions onCancel={() => onOpenChange(false)} loading={loading} label={edit ? "Save Changes" : "Add Customer"} />
      </form>
    </FormDialogShell>
  );
}

export function CreateProductDialog({
  open,
  onOpenChange,
  edit,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: Product | null;
  /** Called after a successful create (not edit). */
  onCreated?: (product: Product) => void;
}) {
  const addProduct = useAppStore((s) => s.addProduct);
  const updateProduct = useAppStore((s) => s.updateProduct);
  const addCategory = useAppStore((s) => s.addCategory);
  const tenantCategories = useTenantCategories();
  const vatEnabled = useVatEnabled();
  const [errors, setErrors] = useState<FieldError>({});
  const [loading, setLoading] = useState(false);
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState("");
  const [form, setForm] = useState({
    name: "",
    sku: "",
    barcode: "",
    brand: "",
    category: "",
    size: "", shade: "", batchNumber: "", expiresOn: "", paoMonths: "12", isTester: false,
    unit: "PCS",
    mrp: "",
    tradePrice: "",
    stock: "0",
    reorderAt: "50",
    vat: "13",
    galla: true,
    image: "",
  });
  const [imageBusy, setImageBusy] = useState(false);

  const categoryOptions = useMemo(() => {
    const names = tenantCategories.map((c) => c.name);
    if (form.category && !names.some((n) => n.toLowerCase() === form.category.toLowerCase())) {
      return [form.category, ...names];
    }
    return names;
  }, [tenantCategories, form.category]);

  useEffect(() => {
    if (!open) return;
    const fallbackCategory = tenantCategories[0]?.name ?? "General";
    if (edit) {
      setForm({
        name: edit.name,
        sku: edit.sku,
        barcode: edit.barcode,
        brand: edit.brand,
        category: edit.category,
        size: edit.size || "", shade: edit.shade || "", batchNumber: edit.batchNumber || "", expiresOn: edit.expiresOn || "", paoMonths: edit.paoMonths || "", isTester: edit.isTester ?? false,
        unit: edit.unit,
        mrp: String(edit.mrp),
        tradePrice: String(edit.tradePrice),
        stock: String(edit.stock),
        reorderAt: String(edit.reorderAt),
        vat: String(vatEnabled ? edit.vat : 0),
        galla: edit.galla !== false,
        image: edit.image || "",
      });
    } else {
      setForm({
        name: "",
        sku: "",
        barcode: "",
        brand: "",
        category: fallbackCategory,
        size: "", shade: "", batchNumber: "", expiresOn: "", paoMonths: "12", isTester: false,
        unit: "PCS",
        mrp: "",
        tradePrice: "",
        stock: "0",
        reorderAt: "50",
        vat: vatEnabled ? "13" : "0",
        galla: true,
        image: "",
      });
    }
    setAddingCategory(false);
    setNewCategory("");
    setErrors({});
    // Reset only when the dialog opens or the edited product changes — not when categories update mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- tenantCategories read once on open
  }, [open, edit, vatEnabled]);

  const reset = () => {
    const fallbackCategory = tenantCategories[0]?.name ?? "General";
    setForm({
      name: "",
      sku: "",
      barcode: "",
      brand: "",
      category: fallbackCategory,
      size: "", shade: "", batchNumber: "", expiresOn: "", paoMonths: "12", isTester: false,
      unit: "PCS",
      mrp: "",
      tradePrice: "",
      stock: "0",
      reorderAt: "50",
      vat: vatEnabled ? "13" : "0",
      galla: true,
      image: "",
    });
    setAddingCategory(false);
    setNewCategory("");
    setErrors({});
  };

  const commitNewCategory = () => {
    const name = newCategory.trim();
    if (!name) {
      setErrors((e) => ({ ...e, category: "Category name is required" }));
      return;
    }
    try {
      const created = addCategory(name);
      setForm((f) => ({ ...f, category: created.name }));
      setAddingCategory(false);
      setNewCategory("");
      setErrors((e) => {
        const next = { ...e };
        delete next.category;
        return next;
      });
    } catch (err) {
      setErrors((e) => ({
        ...e,
        category: err instanceof Error ? err.message : "Could not add category",
      }));
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Product name is required";
    if (!form.sku.trim()) next.sku = "SKU is required";
    if (!form.brand.trim()) next.brand = "Brand is required";
    if (!form.category.trim()) next.category = "Category is required";
    const mrp = Number(form.mrp);
    const trade = Number(form.tradePrice);
    const stock = Number(form.stock);
    const reorderAt = Number(form.reorderAt);
    const vat = vatEnabled ? Number(form.vat) : 0;
    if (!Number.isFinite(mrp) || mrp <= 0) next.mrp = "MRP must be greater than 0";
    if (!Number.isFinite(trade) || trade <= 0) next.tradePrice = "Selling price must be greater than 0";
    if (Number.isFinite(mrp) && Number.isFinite(trade) && trade > mrp) next.tradePrice = "Selling price cannot exceed MRP";
    if (!Number.isFinite(stock) || stock < 0 || !Number.isInteger(stock)) next.stock = "Stock must be a whole number of 0 or more";
    if (!Number.isFinite(reorderAt) || reorderAt < 0) next.reorderAt = "Reorder point must be 0 or more";
    if (form.paoMonths && (!Number.isInteger(Number(form.paoMonths)) || Number(form.paoMonths) < 1 || Number(form.paoMonths) > 60)) next.paoMonths = "Opening period must be 1–60 whole months";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const sku = form.sku.trim().toUpperCase();
      const name = form.name.trim();
      const commercePayload = {
        name,
        sku,
        price: trade,
        mrp,
        stock,
        reorderAt,
        category: form.category.trim() || undefined,
        brand: form.brand.trim() || undefined,
        size: form.size.trim() || undefined,
        shade: form.shade.trim() || undefined,
        images: form.image ? [form.image] : [],
        galla: form.galla,
        vatApplicable: vatEnabled && (vat || 13) > 0,
        isTester: form.isTester,
        barcode: form.barcode.trim() || undefined,
      };

      if (edit) {
        const updated = updateProduct(edit.id, {
          name,
          sku,
          barcode: form.barcode.trim() || edit.barcode,
          brand: form.brand.trim(),
          category: form.category.trim(),
          size: form.size.trim(), shade: form.shade.trim(), batchNumber: form.batchNumber.trim(), expiresOn: form.expiresOn, paoMonths: form.paoMonths, isTester: form.isTester,
          unit: form.unit,
          mrp,
          tradePrice: trade,
          stock,
          reorderAt,
          vat: vatEnabled ? vat || 13 : 0,
          galla: form.galla,
          image: form.image || "",
        });
        if (!updated) throw new Error("Could not update product");
        try {
          await commerceClient.updateProduct(edit.id, commercePayload);
          invalidateProductCache();
        } catch {
          /* Nest offline — Zustand still updated; local commerce may miss this id */
          try {
            await commerceClient.createProduct(commercePayload);
            invalidateProductCache();
          } catch {
            /* ignore dual-write failure */
          }
        }
        toast.success(`Product ${updated.sku} updated`, { description: `${updated.name} · inventory synced` });
      } else {
        const created = addProduct({
          name,
          sku,
          barcode: form.barcode.trim() || `89${Date.now().toString().slice(-10)}`,
          brand: form.brand.trim(),
          category: form.category.trim(),
          size: form.size.trim(), shade: form.shade.trim(), batchNumber: form.batchNumber.trim(), expiresOn: form.expiresOn, paoMonths: form.paoMonths, isTester: form.isTester,
          unit: form.unit,
          mrp,
          tradePrice: trade,
          stock,
          reorderAt,
          vat: vatEnabled ? vat || 13 : 0,
          galla: form.galla,
          image: form.image || "",
        });
        try {
          await commerceClient.createProduct({
            ...commercePayload,
            barcode: created.barcode,
          });
          invalidateProductCache();
        } catch (e) {
          toast.error(
            e instanceof Error
              ? `Saved locally, but inventory sync failed: ${e.message}`
              : "Saved locally, inventory sync failed",
          );
        }
        toast.success(`Product ${created.sku} added`, {
          description: `${created.name} · stock ${stock} in Inventory`,
        });
        onCreated?.(created);
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save product");
    } finally {
      setLoading(false);
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={edit ? "Edit Product" : "Add Product"}
      description={
        edit
          ? "Update SKU details and stock — syncs to Inventory"
          : "Add a SKU with pricing and opening stock — appears in Inventory"
      }
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="space-y-2 sm:w-36">
            <Label>Product image</Label>
            <div className="relative flex h-32 w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-muted/40 sm:w-36">
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element -- local data URL preview
                <img src={form.image} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="px-2 text-center text-xs text-muted-foreground">No image</span>
              )}
            </div>
            <div className="flex gap-1.5">
              <label className="flex-1 cursor-pointer">
                <span className="inline-flex h-8 w-full items-center justify-center rounded-lg border border-border bg-card px-2 text-xs font-medium hover:bg-muted">
                  {imageBusy ? "…" : "Add image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  disabled={imageBusy}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    setImageBusy(true);
                    try {
                      const dataUrl = await fileToProductImage(file);
                      setForm((f) => ({ ...f, image: dataUrl }));
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Could not add image");
                    } finally {
                      setImageBusy(false);
                    }
                  }}
                />
              </label>
              {form.image && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setForm((f) => ({ ...f, image: "" }))}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <Label htmlFor="product-name">Product Name</Label>
            <Input id="product-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Velvet Matte Lipstick" autoFocus />
            <ErrorText message={errors.name} />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-sku">SKU</Label>
            <Input id="product-sku" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="LIP-ROSE-001" />
            <ErrorText message={errors.sku} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-barcode">Barcode</Label>
            <Input id="product-barcode" value={form.barcode} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} placeholder="Optional" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <Label htmlFor="product-brand">Brand</Label>
            <Input id="product-brand" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} placeholder="Velvet" />
            <ErrorText message={errors.brand} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="product-category">Category</Label>
              {!addingCategory && (
                <button
                  type="button"
                  className="text-xs font-medium text-primary hover:underline"
                  onClick={() => {
                    setAddingCategory(true);
                    setNewCategory("");
                  }}
                >
                  Add category
                </button>
              )}
            </div>
            {addingCategory ? (
              <div className="space-y-2">
                <Input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  placeholder="e.g. Eye Makeup"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitNewCategory();
                    }
                    if (e.key === "Escape") {
                      setAddingCategory(false);
                      setNewCategory("");
                    }
                  }}
                />
                <div className="flex gap-1.5">
                  <Button type="button" size="sm" className="flex-1" onClick={commitNewCategory}>
                    Add
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="flex-1"
                    onClick={() => {
                      setAddingCategory(false);
                      setNewCategory("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Select id="product-category"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {categoryOptions.length === 0 && <option value="">Select category</option>}
                {categoryOptions.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>
            )}
            <ErrorText message={errors.category} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-size">Size</Label>
            <Input id="product-size" value={form.size} onChange={(e) => setForm((f) => ({ ...f, size: e.target.value }))} placeholder="30ml, 3.5g, 12 shades…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-unit">Unit</Label>
            <Select id="product-unit" value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}>
              <option>PCS</option>
              <option>CTN</option>
              <option>KG</option>
              <option>LTR</option>
            </Select>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="product-mrp">MRP (NPR)</Label>
            <Input id="product-mrp" type="number" min={0} value={form.mrp} onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))} />
            <ErrorText message={errors.mrp} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-tradePrice">Selling Price (NPR)</Label>
            <Input id="product-tradePrice" type="number" min={0} value={form.tradePrice} onChange={(e) => setForm((f) => ({ ...f, tradePrice: e.target.value }))} />
            <ErrorText message={errors.tradePrice} />
          </div>
        </div>
        <div className={cn("grid gap-4", vatEnabled ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
          <div className="space-y-2">
            <Label htmlFor="product-stock">{edit ? "Stock" : "Opening Stock"}</Label>
            <Input id="product-stock" type="number" min={0} step={1} value={form.stock} onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))} />
            <ErrorText message={errors.stock} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="product-reorderAt">Reorder At</Label>
            <Input id="product-reorderAt" type="number" min={0} value={form.reorderAt} onChange={(e) => setForm((f) => ({ ...f, reorderAt: e.target.value }))} />
            <ErrorText message={errors.reorderAt} />
          </div>
          {vatEnabled && (
            <div className="space-y-2">
              <Label htmlFor="product-vat">VAT %</Label>
              <Input id="product-vat" type="number" min={0} value={form.vat} onChange={(e) => setForm((f) => ({ ...f, vat: e.target.value }))} />
            </div>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="product-shade">Shade / variant</Label><Input id="product-shade" type="text"  value={form.shade} placeholder="Rosewood, Warm Beige…" onChange={(e) => setForm((f) => ({ ...f, shade: e.target.value }))} /></div>
<div className="space-y-2"><Label htmlFor="product-batchNumber">Batch number</Label><Input id="product-batchNumber" type="text"  value={form.batchNumber} placeholder="BT-001-26" onChange={(e) => setForm((f) => ({ ...f, batchNumber: e.target.value }))} /></div>
<div className="space-y-2"><Label htmlFor="product-expiresOn">Expiry date</Label><Input id="product-expiresOn" type="date"  value={form.expiresOn} placeholder="" onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))} /></div>
<div className="space-y-2"><Label htmlFor="product-paoMonths">Period after opening (months)</Label><Input id="product-paoMonths" type="number" min={1} max={60} step={1} value={form.paoMonths} placeholder="12" onChange={(e) => setForm((f) => ({ ...f, paoMonths: e.target.value }))} /></div></div><p className="text-xs text-muted-foreground">Track one batch per SKU. Use a separate SKU for each shade or batch. Expiry is the unopened shelf life; the opening period applies once a product is opened.</p>
        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3">
          <Checkbox
            checked={form.galla}
            onChange={(e) => setForm((f) => ({ ...f, galla: e.target.checked }))}
            className="mt-0.5"
          />
          <span className="space-y-0.5">
            <span className="block text-sm font-medium">Beauty Counter / POS product</span>
            <span className="block text-xs text-muted-foreground">
              Show this SKU on the counter. Turn off for items that should not appear at the counter.
            </span>
          </span>
        </label>
        <label className="flex items-center gap-3 rounded-xl border border-border p-3"><Checkbox checked={form.isTester} onChange={(e) => setForm((f) => ({ ...f, isTester: e.target.checked }))} /><span className="text-sm">Display tester — keep in inventory, block from sales</span></label><ErrorText message={errors.paoMonths} />
        <FormActions onCancel={() => onOpenChange(false)} loading={loading} label={edit ? "Save Changes" : "Add Product"} />
      </form>
    </FormDialogShell>
  );
}

function softValidatePan(pan: string): string | undefined {
  const t = pan.trim();
  if (!t) return undefined;
  if (!/^\d{9}$/.test(t)) return "PAN should be 9 digits when provided";
  return undefined;
}

export function CreateSupplierDialog({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: Supplier | null;
}) {
  const addSupplier = useAppStore((s) => s.addSupplier);
  const updateSupplier = useAppStore((s) => s.updateSupplier);
  const [errors, setErrors] = useState<FieldError>({});
  const [form, setForm] = useState({ name: "", contact: "", phone: "", pan: "" });

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setForm({
        name: edit.name,
        contact: edit.contact,
        phone: edit.phone,
        pan: edit.pan ?? "",
      });
    } else {
      setForm({ name: "", contact: "", phone: "", pan: "" });
    }
    setErrors({});
  }, [open, edit]);

  const reset = () => {
    setForm({ name: "", contact: "", phone: "", pan: "" });
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Supplier name is required";
    if (!form.contact.trim()) next.contact = "Contact person is required";
    if (!form.phone.trim()) next.phone = "Phone is required";
    const panErr = softValidatePan(form.pan);
    if (panErr) next.pan = panErr;
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      if (edit) {
        const updated = updateSupplier(edit.id, {
          name: form.name.trim(),
          contact: form.contact.trim(),
          phone: form.phone.trim(),
          pan: form.pan.trim(),
        });
        if (!updated) throw new Error("Could not update supplier");
        toast.success("Supplier updated", { description: updated.name });
      } else {
        const created = addSupplier({
          name: form.name.trim(),
          contact: form.contact.trim(),
          phone: form.phone.trim(),
          pan: form.pan.trim(),
        });
        toast.success("Supplier added", { description: created.name });
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save supplier");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={edit ? "Edit Supplier" : "Add Supplier"}
      description={edit ? "Update vendor details" : "Register a vendor for purchase orders"}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Supplier Name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Aura Beauty Supply" autoFocus />
          <ErrorText message={errors.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Contact Person</Label>
            <Input value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} placeholder="Suresh Adhikari" />
            <ErrorText message={errors.contact} />
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="01-5522334" />
            <ErrorText message={errors.phone} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>
            PAN Number <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            value={form.pan}
            onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value.replace(/\D/g, "").slice(0, 9) }))}
            placeholder="301234567"
            inputMode="numeric"
            maxLength={9}
          />
          <ErrorText message={errors.pan} />
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label={edit ? "Save Changes" : "Add Supplier"} />
      </form>
    </FormDialogShell>
  );
}

export function CreateOrderDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const customers = useTenantCustomers();
  const products = useTenantProducts();
  const addOrder = useAppStore((s) => s.addOrder);
  const fulfillOrder = useAppStore((s) => s.fulfillOrder);
  const vatEnabled = useVatEnabled();
  const [errors, setErrors] = useState<FieldError>({});
  const [customerId, setCustomerId] = useState("");
  const [fulfilled, setFulfilled] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  const [method, setMethod] = useState("CREDIT");
  const [splitCash, setSplitCash] = useState("");
  const [splitQr, setSplitQr] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const resolved = useMemo(() => {
    return lines
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const qty = Number(line.qty);
        const unitPrice = Number(line.unitPrice);
        const discountPercent = Number(line.discountPercent) || 0;
        if (!product || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }
        const item: InvoiceLineItem = {
          productId: product.id,
          sku: product.sku,
          name: product.size ? `${product.name} ${product.size}` : product.name,
          qty,
          unitPrice,
          discountPercent,
          lineTotal: calcLineTotal(qty, unitPrice, discountPercent),
        };
        return item;
      })
      .filter(Boolean) as InvoiceLineItem[];
  }, [lines, products]);

  const subtotal = resolved.reduce((s, l) => s + l.lineTotal, 0);
  const { vat, total } = calcVatIfEnabled(subtotal, vatEnabled);

  const setStatus = (status: "PAID" | "UNPAID") => {
    setPaymentStatus(status);
    if (status === "UNPAID" && method !== "CREDIT") {
      setMethod("CREDIT");
    } else if (status === "PAID" && method === "CREDIT") {
      setMethod("CASH");
    }
  };

  const setPaymentMethod = (next: string) => {
    setMethod(next);
    if (next === "CREDIT") setPaymentStatus("UNPAID");
  };

  const reset = () => {
    setCustomerId("");
    setFulfilled(false);
    setPaymentStatus("UNPAID");
    setMethod("CREDIT");
    setSplitCash("");
    setSplitQr("");
    setLines([]);
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) next.customerId = "Select a customer";
    if (resolved.length === 0) next.lines = "Add at least one product with quantity and price";
    for (const item of resolved) {
      const product = products.find((p) => p.id === item.productId);
      if (product && item.qty > product.stock) {
        next.lines = `${product.name} only has ${product.stock} in stock`;
        break;
      }
      if (item.unitPrice > (product?.mrp ?? Infinity)) {
        next.lines = `${item.name}: unit price cannot exceed MRP`;
        break;
      }
    }

    if (fulfilled) {
      const cashAmt = Number(splitCash) || 0;
      const qrAmt = Number(splitQr) || 0;
      if (method === "SPLIT" && paymentStatus === "PAID") {
        if (Math.round(cashAmt + qrAmt) !== total) {
          next.split = `Cash + QR must equal total ${formatNPR(total)}`;
        }
      }
      if (paymentStatus === "UNPAID" && customer) {
        if (customer.outstanding + total > customer.creditLimit) {
          next.method = `Credit limit exceeded (limit ${formatNPR(customer.creditLimit)}, outstanding ${formatNPR(customer.outstanding)})`;
        }
      }
    }

    setErrors(next);
    if (Object.keys(next).length || !customer) return;

    const created = addOrder({
      customer: customer.name,
      customerId: customer.id,
      items: resolved,
      total: subtotal,
      status: "CONFIRMED",
    });

    if (fulfilled) {
      const result = fulfillOrder(created.id, {
        items: resolved,
        paymentStatus,
        method,
        splitCash: Number(splitCash) || undefined,
        splitQr: Number(splitQr) || undefined,
      });
      if (result) {
        toast.success(`Order ${created.number} fulfilled`, {
          description: `Invoice ${result.invoice.number} · ${formatNPR(result.invoice.total)} · ${paymentStatus === "UNPAID" ? "Unpaid" : "Paid"}`,
        });
      } else {
        toast.error("Order created but fulfillment failed");
      }
    } else {
      toast.success(`Order ${created.number} created`, {
        description: `${resolved.length} lines · ${formatNPR(subtotal)} · Not fulfilled`,
      });
    }

    reset();
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="New Sales Order"
      description="Select customer and products. Mark fulfilled to create a sales invoice."
      xwide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Customer</Label>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.area}
                </option>
              ))}
            </Select>
            <ErrorText message={errors.customerId} />
          </div>
          <div className="space-y-2">
            <Label>Fulfillment</Label>
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setFulfilled(false)}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  !fulfilled
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Not fulfilled
              </button>
              <button
                type="button"
                onClick={() => setFulfilled(true)}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  fulfilled
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Fulfilled
              </button>
            </div>
          </div>
        </div>

        {fulfilled && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Payment status</Label>
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setStatus("PAID")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    paymentStatus === "PAID"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Paid
                </button>
                <button
                  type="button"
                  onClick={() => setStatus("UNPAID")}
                  className={cn(
                    "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    paymentStatus === "UNPAID"
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Not paid
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={method} onChange={(e) => setPaymentMethod(e.target.value)}>
                <option value="CASH">Cash</option>
                <option value="CREDIT">Credit</option>
                <option value="QR_ESEWA">QR eSewa</option>
                <option value="QR_KHALTI">QR Khalti</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="SPLIT">Split (Cash + QR)</option>
              </Select>
              <ErrorText message={errors.method} />
            </div>
          </div>
        )}

        {fulfilled && method === "SPLIT" && paymentStatus === "PAID" && (
          <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cash amount</Label>
              <Input type="number" min={0} value={splitCash} onChange={(e) => setSplitCash(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>QR amount</Label>
              <Input type="number" min={0} value={splitQr} onChange={(e) => setSplitQr(e.target.value)} />
            </div>
            <ErrorText message={errors.split} />
          </div>
        )}

        <LineItemsEditor
          lines={lines}
          products={products}
          onChange={setLines}
          error={errors.lines}
          customerId={customerId || undefined}
        />

        {subtotal > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({resolved.length} lines)</span>
              <span>{formatNPR(subtotal)}</span>
            </div>
            {fulfilled ? (
              <>
                {vatEnabled && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>VAT 13%</span>
                    <span>{formatNPR(vat)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                  <span>Invoice total {paymentStatus === "UNPAID" ? "(due)" : ""}</span>
                  <span className="text-primary">{formatNPR(total)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <span>{vatEnabled ? "Order total (excl. VAT)" : "Order total"}</span>
                <span>{formatNPR(subtotal)}</span>
              </div>
            )}
          </div>
        )}

        <FormActions
          onCancel={() => onOpenChange(false)}
          label={fulfilled ? "Create & Fulfill" : "Create Order"}
        />
      </form>
    </FormDialogShell>
  );
}

function linesFromOrderItems(items: InvoiceLineItem[]): DraftLine[] {
  return items.map((item, idx) => ({
    key: `${item.productId}-${idx}`,
    productId: item.productId,
    qty: String(item.qty),
    unitPrice: String(item.unitPrice),
    discountPercent: String(item.discountPercent ?? 0),
  }));
}

export function FulfillOrderDialog({
  order,
  open,
  onOpenChange,
}: {
  order: Order | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const customers = useTenantCustomers();
  const products = useTenantProducts();
  const fulfillOrder = useAppStore((s) => s.fulfillOrder);
  const vatEnabled = useVatEnabled();
  const [errors, setErrors] = useState<FieldError>({});
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("UNPAID");
  const [method, setMethod] = useState("CREDIT");
  const [splitCash, setSplitCash] = useState("");
  const [splitQr, setSplitQr] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  useEffect(() => {
    if (!open || !order) return;
    setLines(linesFromOrderItems(order.items ?? []));
    setPaymentStatus("UNPAID");
    setMethod("CREDIT");
    setSplitCash("");
    setSplitQr("");
    setErrors({});
  }, [open, order]);

  const resolved = useMemo(() => {
    return lines
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const qty = Number(line.qty);
        const unitPrice = Number(line.unitPrice);
        const discountPercent = Number(line.discountPercent) || 0;
        if (!product || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }
        const item: InvoiceLineItem = {
          productId: product.id,
          sku: product.sku,
          name: product.size ? `${product.name} ${product.size}` : product.name,
          qty,
          unitPrice,
          discountPercent,
          lineTotal: calcLineTotal(qty, unitPrice, discountPercent),
        };
        return item;
      })
      .filter(Boolean) as InvoiceLineItem[];
  }, [lines, products]);

  const subtotal = resolved.reduce((s, l) => s + l.lineTotal, 0);
  const { vat, total } = calcVatIfEnabled(subtotal, vatEnabled);

  const setStatus = (status: "PAID" | "UNPAID") => {
    setPaymentStatus(status);
    if (status === "UNPAID" && method !== "CREDIT") {
      setMethod("CREDIT");
    } else if (status === "PAID" && method === "CREDIT") {
      setMethod("CASH");
    }
  };

  const setPaymentMethod = (next: string) => {
    setMethod(next);
    if (next === "CREDIT") setPaymentStatus("UNPAID");
  };

  const reset = () => {
    setLines([]);
    setPaymentStatus("UNPAID");
    setMethod("CREDIT");
    setSplitCash("");
    setSplitQr("");
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!order) return;

    const next: FieldError = {};
    const customer =
      customers.find((c) => c.id === order.customerId) ??
      customers.find((c) => c.name === order.customer);

    if (resolved.length === 0) next.lines = "Add at least one product to fulfill";

    for (const item of resolved) {
      const product = products.find((p) => p.id === item.productId);
      if (product && item.qty > product.stock) {
        next.lines = `${product.name} only has ${product.stock} in stock`;
        break;
      }
      if (item.unitPrice > (product?.mrp ?? Infinity)) {
        next.lines = `${item.name}: unit price cannot exceed MRP`;
        break;
      }
    }

    const cashAmt = Number(splitCash) || 0;
    const qrAmt = Number(splitQr) || 0;
    if (method === "SPLIT" && paymentStatus === "PAID") {
      if (Math.round(cashAmt + qrAmt) !== total) {
        next.split = `Cash + QR must equal total ${formatNPR(total)}`;
      }
    }

    if (paymentStatus === "UNPAID" && customer) {
      if (customer.outstanding + total > customer.creditLimit) {
        next.method = `Credit limit exceeded (limit ${formatNPR(customer.creditLimit)}, outstanding ${formatNPR(customer.outstanding)})`;
      }
    }

    setErrors(next);
    if (Object.keys(next).length) return;

    const result = fulfillOrder(order.id, {
      items: resolved,
      paymentStatus,
      method,
      splitCash: cashAmt || undefined,
      splitQr: qrAmt || undefined,
    });

    if (!result) {
      toast.error("Could not fulfill order", {
        description: "It may already be invoiced.",
      });
      return;
    }

    toast.success(`Order ${order.number} fulfilled`, {
      description: `Invoice ${result.invoice.number} · ${formatNPR(result.invoice.total)} · ${paymentStatus === "UNPAID" ? "Unpaid" : "Paid"}`,
    });
    reset();
    onOpenChange(false);
  };

  if (!order) return null;

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={`Fulfill ${order.number}`}
      description={`Customize lines for ${order.customer}, then create a sales invoice.`}
      xwide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1 sm:col-span-1">
            <Label>Customer</Label>
            <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm font-medium">
              {order.customer}
            </p>
          </div>
          <div className="space-y-2">
            <Label>Payment status</Label>
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setStatus("PAID")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  paymentStatus === "PAID"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setStatus("UNPAID")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  paymentStatus === "UNPAID"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Not paid
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
              <option value="QR_ESEWA">QR eSewa</option>
              <option value="QR_KHALTI">QR Khalti</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="SPLIT">Split (Cash + QR)</option>
            </Select>
            <ErrorText message={errors.method} />
          </div>
        </div>

        {method === "SPLIT" && paymentStatus === "PAID" && (
          <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cash amount</Label>
              <Input type="number" min={0} value={splitCash} onChange={(e) => setSplitCash(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>QR amount</Label>
              <Input type="number" min={0} value={splitQr} onChange={(e) => setSplitQr(e.target.value)} />
            </div>
            <ErrorText message={errors.split} />
          </div>
        )}

        <LineItemsEditor
          lines={lines}
          products={products}
          onChange={setLines}
          error={errors.lines}
          customerId={order?.customerId}
        />

        {subtotal > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({resolved.length} lines)</span>
              <span>{formatNPR(subtotal)}</span>
            </div>
            {vatEnabled && (
              <div className="flex justify-between text-muted-foreground">
                <span>VAT 13%</span>
                <span>{formatNPR(vat)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Invoice total {paymentStatus === "UNPAID" ? "(due)" : ""}</span>
              <span className="text-primary">{formatNPR(total)}</span>
            </div>
          </div>
        )}

        <FormActions onCancel={() => onOpenChange(false)} label="Fulfill & Invoice" />
      </form>
    </FormDialogShell>
  );
}

export function CreatePurchaseOrderDialog({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: PurchaseOrder | null;
}) {
  const suppliers = useTenantSuppliers();
  const products = useTenantProducts();
  const addPurchaseOrder = useAppStore((s) => s.addPurchaseOrder);
  const updatePurchaseOrder = useAppStore((s) => s.updatePurchaseOrder);
  const [errors, setErrors] = useState<FieldError>({});
  const [mode, setMode] = useState<"estimate" | "products">("estimate");
  const [form, setForm] = useState({ supplierId: "", total: "", status: "ORDERED" });
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [productOpen, setProductOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (edit) {
      const match = suppliers.find((s) => s.name === edit.supplier);
      const hasItems = Array.isArray(edit.items) && edit.items.length > 0;
      setMode(hasItems ? "products" : "estimate");
      setForm({
        supplierId: match?.id ?? "",
        total: String(edit.total),
        status: edit.status,
      });
      setLines(hasItems ? linesFromOrderItems(edit.items!) : []);
    } else {
      setMode("estimate");
      setForm({ supplierId: "", total: "", status: "ORDERED" });
      setLines([]);
    }
    setErrors({});
    setProductOpen(false);
  }, [open, edit, suppliers]);

  const catalog = useMemo(
    () =>
      products.map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        brand: p.brand,
        category: p.category,
        size: p.size,
        tradePrice: p.tradePrice,
        stock: p.stock,
        mrp: p.mrp,
      })),
    [products]
  );

  const resolved = useMemo(() => {
    return lines
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const qty = Number(line.qty);
        const unitPrice = Number(line.unitPrice);
        const discountPercent = Number(line.discountPercent) || 0;
        if (!product || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }
        const item: InvoiceLineItem = {
          productId: product.id,
          sku: product.sku,
          name: product.size ? `${product.name} ${product.size}` : product.name,
          qty,
          unitPrice,
          discountPercent,
          lineTotal: calcLineTotal(qty, unitPrice, discountPercent),
        };
        return item;
      })
      .filter(Boolean) as InvoiceLineItem[];
  }, [lines, products]);

  const linesTotal = useMemo(() => resolved.reduce((s, i) => s + i.lineTotal, 0), [resolved]);

  const reset = () => {
    setMode("estimate");
    setForm({ supplierId: "", total: "", status: "ORDERED" });
    setLines([]);
    setErrors({});
    setProductOpen(false);
  };

  const addCreatedProductToLines = (product: Product) => {
    setLines((prev) => {
      const selected = prev.filter((l) => l.productId);
      const existing = selected.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.key === existing.key ? { ...l, qty: String(Number(l.qty || 0) + 1) } : l
        );
      }
      return [
        ...selected,
        {
          key: `${Date.now()}-${product.id}`,
          productId: product.id,
          qty: "1",
          unitPrice: String(product.tradePrice),
          discountPercent: "0",
        },
      ];
    });
    setMode("products");
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    const supplier = suppliers.find((s) => s.id === form.supplierId);
    if (!supplier) next.supplierId = "Select a supplier";

    let total = 0;
    let items: InvoiceLineItem[] | undefined;

    if (mode === "estimate") {
      total = Number(form.total);
      if (!Number.isFinite(total) || total <= 0) next.total = "Estimated total must be greater than 0";
      items = undefined;
    } else {
      if (!resolved.length) next.lines = "Add at least one product line";
      const incomplete = lines.some((l) => l.productId) && resolved.length < lines.filter((l) => l.productId).length;
      if (incomplete) next.lines = "Fix qty and price on all selected lines";
      total = linesTotal;
      if (!next.lines && (!Number.isFinite(total) || total <= 0)) next.lines = "Line total must be greater than 0";
      items = resolved;
    }

    setErrors(next);
    if (Object.keys(next).length || !supplier) return;

    try {
      if (edit) {
        const updated = updatePurchaseOrder(edit.id, {
          supplier: supplier.name,
          total,
          status: form.status,
          items: items ?? [],
        });
        if (!updated) throw new Error("Could not update PO");
        toast.success(`PO ${updated.number} updated`, { description: supplier.name });
      } else {
        const created = addPurchaseOrder({
          supplier: supplier.name,
          total,
          status: "ORDERED",
          ...(items?.length ? { items } : {}),
        });
        toast.success(`PO ${created.number} created`, { description: supplier.name });
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save PO");
    }
  };

  return (
    <>
      <FormDialogShell
        open={open}
        onOpenChange={(v) => {
          if (!v) reset();
          onOpenChange(v);
        }}
        title={edit ? "Edit Purchase Order" : "New Purchase Order"}
        description={edit ? `Update ${edit.number}` : "Raise a PO to a supplier — with products or estimate only"}
        xwide={mode === "products"}
        wide={mode === "estimate"}
      >
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label>Supplier</Label>
            <Select value={form.supplierId} onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}>
              <option value="">Select supplier…</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.contact ? ` — ${s.contact}` : ""}
                  {s.pan ? ` · PAN ${s.pan}` : ""}
                </option>
              ))}
            </Select>
            <ErrorText message={errors.supplierId} />
          </div>

          <div className="space-y-2">
            <Label>PO type</Label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setMode("estimate")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  mode === "estimate"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                Estimate only
              </button>
              <button
                type="button"
                onClick={() => setMode("products")}
                className={cn(
                  "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                  mode === "products"
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:bg-muted/40"
                )}
              >
                With products
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "estimate"
                ? "Enter an estimated total without line items."
                : "Add catalog products (or create a new SKU). Total is derived from lines."}
            </p>
          </div>

          {mode === "estimate" ? (
            <div className="space-y-2">
              <Label>Estimated Total (NPR)</Label>
              <Input
                type="number"
                min={0}
                value={form.total}
                onChange={(e) => setForm((f) => ({ ...f, total: e.target.value }))}
                placeholder="185000"
              />
              <ErrorText message={errors.total} />
            </div>
          ) : (
            <div className="space-y-3">
              <LineItemsEditor
                mode="purchase"
                lines={lines}
                products={catalog}
                onChange={setLines}
                error={errors.lines}
                toolbar={
                  <Button type="button" variant="outline" size="sm" onClick={() => setProductOpen(true)}>
                    <Plus className="h-3.5 w-3.5" /> New product
                  </Button>
                }
              />
              <div className="flex justify-between rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm">
                <span>PO total ({resolved.length} lines)</span>
                <span className="font-semibold text-primary">{formatNPR(linesTotal)}</span>
              </div>
            </div>
          )}

          {edit && (
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="DRAFT">Draft</option>
                <option value="ORDERED">Ordered</option>
                <option value="PARTIALLY_RECEIVED">Partial</option>
                <option value="RECEIVED">Received</option>
                <option value="CANCELLED">Cancelled</option>
              </Select>
            </div>
          )}
          <FormActions onCancel={() => onOpenChange(false)} label={edit ? "Save Changes" : "Create PO"} />
        </form>
      </FormDialogShell>

      <CreateProductDialog
        open={productOpen}
        onOpenChange={setProductOpen}
        onCreated={addCreatedProductToLines}
      />
    </>
  );
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const customers = useTenantCustomers();
  const products = useTenantProducts();
  const addInvoice = useAppStore((s) => s.addInvoice);
  const vatEnabled = useVatEnabled();
  const [errors, setErrors] = useState<FieldError>({});
  const [customerId, setCustomerId] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"PAID" | "UNPAID">("PAID");
  const [method, setMethod] = useState("CASH");
  const [splitCash, setSplitCash] = useState("");
  const [splitQr, setSplitQr] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([]);

  const resolved = useMemo(() => {
    return lines
      .map((line) => {
        const product = products.find((p) => p.id === line.productId);
        const qty = Number(line.qty);
        const unitPrice = Number(line.unitPrice);
        const discountPercent = Number(line.discountPercent) || 0;
        if (!product || !Number.isFinite(qty) || qty < 1 || !Number.isFinite(unitPrice) || unitPrice < 0) {
          return null;
        }
        const item: InvoiceLineItem = {
          productId: product.id,
          sku: product.sku,
          name: product.size ? `${product.name} ${product.size}` : product.name,
          qty,
          unitPrice,
          discountPercent,
          lineTotal: calcLineTotal(qty, unitPrice, discountPercent),
        };
        return item;
      })
      .filter(Boolean) as InvoiceLineItem[];
  }, [lines, products]);

  const subtotal = resolved.reduce((s, l) => s + l.lineTotal, 0);
  const { vat, total } = calcVatIfEnabled(subtotal, vatEnabled);

  const setStatus = (status: "PAID" | "UNPAID") => {
    setPaymentStatus(status);
    if (status === "UNPAID" && method !== "CREDIT") {
      setMethod("CREDIT");
    } else if (status === "PAID" && method === "CREDIT") {
      setMethod("CASH");
    }
  };

  const setPaymentMethod = (next: string) => {
    setMethod(next);
    if (next === "CREDIT") setPaymentStatus("UNPAID");
    else if (paymentStatus === "UNPAID" && next !== "CREDIT") {
      // keep unpaid for cash/QR/etc when money wasn't collected yet
    }
  };

  const reset = () => {
    setCustomerId("");
    setPaymentStatus("PAID");
    setMethod("CASH");
    setSplitCash("");
    setSplitQr("");
    setLines([]);
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) next.customerId = "Select a customer";
    if (resolved.length === 0) next.lines = "Add at least one product to sell";

    for (const item of resolved) {
      const product = products.find((p) => p.id === item.productId);
      if (product && item.qty > product.stock) {
        next.lines = `${product.name} only has ${product.stock} in stock`;
        break;
      }
      if (item.unitPrice > (product?.mrp ?? Infinity)) {
        next.lines = `${item.name}: unit price cannot exceed MRP`;
        break;
      }
    }

    const cashAmt = Number(splitCash) || 0;
    const qrAmt = Number(splitQr) || 0;
    if (method === "SPLIT" && paymentStatus === "PAID") {
      if (Math.round(cashAmt + qrAmt) !== total) {
        next.split = `Cash + QR must equal total ${formatNPR(total)}`;
      }
    }

    const isUnpaid = paymentStatus === "UNPAID";
    if (isUnpaid && customer) {
      if (customer.outstanding + total > customer.creditLimit) {
        next.method = `Credit limit exceeded (limit ${formatNPR(customer.creditLimit)}, outstanding ${formatNPR(customer.outstanding)})`;
      }
    }

    setErrors(next);
    if (Object.keys(next).length || !customer) return;

    const created = addInvoice({
      customer: customer.name,
      customerId: customer.id,
      status: isUnpaid ? "ISSUED" : "PAID",
      method,
      subtotal,
      vat,
      total,
      due: isUnpaid ? total : 0,
      items: resolved,
      splitCash: method === "SPLIT" && !isUnpaid ? cashAmt : undefined,
      splitQr: method === "SPLIT" && !isUnpaid ? qrAmt : undefined,
    });

    toast.success(`Invoice ${created.number} issued`, {
      description: `${resolved.length} lines · ${customer.name} · ${formatNPR(total)} · ${isUnpaid ? "Unpaid" : "Paid"}`,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="New Invoice"
      description={
        vatEnabled
          ? "Pick products by category. Set payment status and method. Totals include 13% VAT."
          : "Pick products by category. Set payment status and method."
      }
      xwide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <Label>Customer</Label>
            <Select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">Select customer…</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} — {c.area}
                </option>
              ))}
            </Select>
            <ErrorText message={errors.customerId} />
          </div>
          <div className="space-y-2">
            <Label>Payment status</Label>
            <div className="flex rounded-lg border border-border p-0.5">
              <button
                type="button"
                onClick={() => setStatus("PAID")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  paymentStatus === "PAID"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Paid
              </button>
              <button
                type="button"
                onClick={() => setStatus("UNPAID")}
                className={cn(
                  "flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  paymentStatus === "UNPAID"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Not paid
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Payment method</Label>
            <Select value={method} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="CASH">Cash</option>
              <option value="CREDIT">Credit</option>
              <option value="QR_ESEWA">QR eSewa</option>
              <option value="QR_KHALTI">QR Khalti</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="SPLIT">Split (Cash + QR)</option>
            </Select>
            <ErrorText message={errors.method} />
          </div>
        </div>

        {method === "SPLIT" && paymentStatus === "PAID" && (
          <div className="grid gap-4 rounded-xl border border-border bg-muted/30 p-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Cash amount</Label>
              <Input type="number" min={0} value={splitCash} onChange={(e) => setSplitCash(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>QR amount</Label>
              <Input type="number" min={0} value={splitQr} onChange={(e) => setSplitQr(e.target.value)} />
            </div>
            <ErrorText message={errors.split} />
          </div>
        )}

        <LineItemsEditor
          lines={lines}
          products={products}
          onChange={setLines}
          error={errors.lines}
          customerId={customerId || undefined}
        />

        {subtotal > 0 && (
          <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal ({resolved.length} lines)</span>
              <span>{formatNPR(subtotal)}</span>
            </div>
            {vatEnabled && (
              <div className="flex justify-between text-muted-foreground">
                <span>VAT 13%</span>
                <span>{formatNPR(vat)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
              <span>Total {paymentStatus === "UNPAID" ? "(due)" : ""}</span>
              <span className="text-primary">{formatNPR(total)}</span>
            </div>
          </div>
        )}

        <FormActions onCancel={() => onOpenChange(false)} label="Issue Invoice" />
      </form>
    </FormDialogShell>
  );
}

export function CreateExpenseDialog({
  open,
  onOpenChange,
  edit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  edit?: Expense | null;
}) {
  const addExpense = useAppStore((s) => s.addExpense);
  const updateExpense = useAppStore((s) => s.updateExpense);
  const [errors, setErrors] = useState<FieldError>({});
  const [form, setForm] = useState({ category: "Fuel", description: "", amount: "", status: "APPROVED" });

  useEffect(() => {
    if (!open) return;
    if (edit) {
      setForm({
        category: edit.category,
        description: edit.description,
        amount: String(edit.amount),
        status: edit.status,
      });
    } else {
      setForm({ category: "Fuel", description: "", amount: "", status: "APPROVED" });
    }
    setErrors({});
  }, [open, edit]);

  const reset = () => {
    setForm({ category: "Fuel", description: "", amount: "", status: "APPROVED" });
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.description.trim()) next.description = "Description is required";
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) next.amount = "Amount must be greater than 0";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      if (edit) {
        const updated = updateExpense(edit.id, {
          category: form.category,
          description: form.description.trim(),
          amount,
          status: form.status,
        });
        if (!updated) throw new Error("Could not update expense");
        toast.success("Expense updated", {
          description: `${updated.category} · Rs ${updated.amount.toLocaleString()}`,
        });
      } else {
        const created = addExpense({
          category: form.category,
          description: form.description.trim(),
          amount,
          status: "APPROVED",
        });
        toast.success("Expense recorded", {
          description: `${created.category} · Rs ${created.amount.toLocaleString()}`,
        });
      }
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save expense");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title={edit ? "Edit Expense" : "Record Expense"}
      description={edit ? "Update expense details" : "Log a cash or operational expense"}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Category</Label>
          <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
            <option>Fuel</option>
            <option>Salary</option>
            <option>Rent</option>
            <option>Utilities</option>
            <option>Transport</option>
            <option>Other</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Delivery van diesel"
            rows={3}
          />
          <ErrorText message={errors.description} />
        </div>
        <div className="space-y-2">
          <Label>Amount (NPR)</Label>
          <Input type="number" min={0} value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
          <ErrorText message={errors.amount} />
        </div>
        {edit && (
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
              <option value="DRAFT">Draft</option>
              <option value="APPROVED">Approved</option>
              <option value="PAID">Paid</option>
              <option value="REJECTED">Rejected</option>
            </Select>
          </div>
        )}
        <FormActions onCancel={() => onOpenChange(false)} label={edit ? "Save Changes" : "Save Expense"} />
      </form>
    </FormDialogShell>
  );
}

export function EditOrderDialog({
  open,
  onOpenChange,
  order,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  order: Order | null;
}) {
  const customers = useTenantCustomers();
  const updateOrder = useAppStore((s) => s.updateOrder);
  const [errors, setErrors] = useState<FieldError>({});
  const [customerId, setCustomerId] = useState("");
  const [status, setStatus] = useState("CONFIRMED");

  useEffect(() => {
    if (!open || !order) return;
    const match =
      customers.find((c) => c.id === order.customerId) ??
      customers.find((c) => c.name === order.customer);
    setCustomerId(match?.id ?? "");
    setStatus(order.status);
    setErrors({});
  }, [open, order, customers]);

  if (!order) return null;
  const locked = !!order.invoiceId;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const customer = customers.find((c) => c.id === customerId);
    if (!locked && !customer) {
      setErrors({ customerId: "Select a customer" });
      return;
    }
    try {
      const updated = updateOrder(order.id, locked
        ? { status }
        : {
            customer: customer!.name,
            customerId: customer!.id,
            status,
          });
      if (!updated) throw new Error("Could not update order");
      toast.success(`Order ${updated.number} updated`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update order");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${order.number}`}
      description={locked ? "Invoiced orders can only change status" : "Update customer or status"}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Customer</Label>
          <Select
            value={customerId}
            disabled={locked}
            onChange={(e) => setCustomerId(e.target.value)}
          >
            <option value="">Select customer…</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <ErrorText message={errors.customerId} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="PICKING">Picking</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="INVOICED">Invoiced</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Save Changes" />
      </form>
    </FormDialogShell>
  );
}

export function EditInvoiceDialog({
  open,
  onOpenChange,
  invoice,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  invoice: Invoice | null;
}) {
  const updateInvoice = useAppStore((s) => s.updateInvoice);
  const [status, setStatus] = useState("ISSUED");
  const [method, setMethod] = useState("CASH");

  useEffect(() => {
    if (!open || !invoice) return;
    setStatus(invoice.status);
    setMethod(invoice.method);
  }, [open, invoice]);

  if (!invoice) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    try {
      const due =
        status === "PAID" ? 0 : status === "ISSUED" || status === "PARTIALLY_PAID" ? invoice.due || invoice.total : invoice.due;
      const updated = updateInvoice(invoice.id, {
        status,
        method,
        due: status === "PAID" ? 0 : due,
      });
      if (!updated) throw new Error("Could not update invoice");
      toast.success(`Invoice ${updated.number} updated`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update invoice");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${invoice.number}`}
      description="Update invoice status or payment method"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="ISSUED">Issued</option>
            <option value="PARTIALLY_PAID">Partially paid</option>
            <option value="PAID">Paid</option>
            <option value="CANCELLED">Cancelled</option>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Payment method</Label>
          <Select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="CREDIT">Credit</option>
            <option value="QR_ESEWA">QR eSewa</option>
            <option value="QR_KHALTI">QR Khalti</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="SPLIT">Split</option>
          </Select>
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Save Changes" />
      </form>
    </FormDialogShell>
  );
}

export function EditClientDialog({
  open,
  onOpenChange,
  tenant,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenant: { id: string; name: string; shortName: string; vatEnabled?: boolean } | null;
}) {
  const updateTenant = useAppStore((s) => s.updateTenant);
  const [errors, setErrors] = useState<FieldError>({});
  const [form, setForm] = useState({ name: "", shortName: "", vatEnabled: true });

  useEffect(() => {
    if (!open || !tenant) return;
    setForm({
      name: tenant.name,
      shortName: tenant.shortName,
      vatEnabled: tenant.vatEnabled !== false,
    });
    setErrors({});
  }, [open, tenant]);

  if (!tenant) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Company name is required";
    if (!form.shortName.trim()) next.shortName = "Short name is required";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const updated = updateTenant(tenant.id, {
        name: form.name.trim(),
        shortName: form.shortName.trim(),
        vatEnabled: form.vatEnabled,
      });
      if (!updated) throw new Error("Could not update client");
      toast.success("Client updated", { description: updated.shortName });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update client");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Edit Client"
      description="Update company name, short name, and VAT service"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Company name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
          <ErrorText message={errors.name} />
        </div>
        <div className="space-y-2">
          <Label>Short name</Label>
          <Input
            value={form.shortName}
            onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
          />
          <ErrorText message={errors.shortName} />
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Checkbox
            checked={form.vatEnabled}
            onChange={(e) => setForm((f) => ({ ...f, vatEnabled: e.target.checked }))}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">VAT service</p>
            <p className="text-xs text-muted-foreground">
              When off, this client cannot add or charge VAT on products, invoices, orders, or counter sales.
            </p>
          </div>
          {form.vatEnabled ? (
            <Badge variant="success">On</Badge>
          ) : (
            <Badge variant="muted">Off</Badge>
          )}
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Save Changes" />
      </form>
    </FormDialogShell>
  );
}

export function AdjustInventoryDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  product: Product | null;
}) {
  const updateProduct = useAppStore((s) => s.updateProduct);
  const [errors, setErrors] = useState<FieldError>({});
  const [form, setForm] = useState({ stock: "", reorderAt: "" });

  useEffect(() => {
    if (!open || !product) return;
    setForm({ stock: String(product.stock), reorderAt: String(product.reorderAt) });
    setErrors({});
  }, [open, product]);

  if (!product) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const stock = Number(form.stock);
    const reorderAt = Number(form.reorderAt);
    const next: FieldError = {};
    if (!Number.isFinite(stock) || stock < 0) next.stock = "Stock must be 0 or more";
    if (!Number.isFinite(reorderAt) || reorderAt < 0) next.reorderAt = "Reorder point must be 0 or more";
    setErrors(next);
    if (Object.keys(next).length) return;
    try {
      const updated = updateProduct(product.id, { stock, reorderAt });
      if (!updated) throw new Error("Could not update inventory");
      toast.success(`Stock updated for ${updated.sku}`, {
        description: `${updated.stock.toLocaleString()} on hand`,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update inventory");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={`Adjust stock — ${product.sku}`}
      description={product.name}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>On-hand quantity</Label>
          <Input
            type="number"
            min={0}
            value={form.stock}
            onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
            autoFocus
          />
          <ErrorText message={errors.stock} />
        </div>
        <div className="space-y-2">
          <Label>Reorder at</Label>
          <Input
            type="number"
            min={0}
            value={form.reorderAt}
            onChange={(e) => setForm((f) => ({ ...f, reorderAt: e.target.value }))}
          />
          <ErrorText message={errors.reorderAt} />
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Save Stock" />
      </form>
    </FormDialogShell>
  );
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

/** Daily / selective SKU rate change from Inventory — writes PriceListItem history only for chosen products. */
export function UpdateInventoryPriceDialog({
  open,
  onOpenChange,
  products,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  products: Product[];
}) {
  const priceLists = useTenantPriceLists();
  const applyOvernightRates = useAppStore((s) => s.applyOvernightRates);
  const [errors, setErrors] = useState<FieldError>({});
  const [priceListId, setPriceListId] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(todayIsoDate());
  const [rates, setRates] = useState<Record<string, string>>({});

  const defaultListId = useMemo(
    () => priceLists.find((l) => l.isDefault)?.id ?? priceLists[0]?.id ?? "",
    [priceLists]
  );

  useEffect(() => {
    if (!open || !products.length) return;
    setPriceListId(defaultListId);
    setEffectiveFrom(todayIsoDate());
    setErrors({});
    const next: Record<string, string> = {};
    for (const p of products) {
      const current = resolveUnitPrice({ productId: p.id, date: todayIsoDate() });
      next[p.id] = String(current > 0 ? current : p.tradePrice);
    }
    setRates(next);
  }, [open, products, defaultListId]);

  if (!products.length) return null;

  const single = products.length === 1;
  const selectedList = priceLists.find((l) => l.id === priceListId);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!priceListId) next.priceListId = "Select a price list";
    if (!effectiveFrom) next.effectiveFrom = "Effective date is required";

    const payload: { productId: string; unitPrice: number }[] = [];
    for (const p of products) {
      const unitPrice = Number(rates[p.id]);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        next[`rate_${p.id}`] = "Enter a valid rate";
        continue;
      }
      payload.push({ productId: p.id, unitPrice });
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    applyOvernightRates(priceListId, payload, effectiveFrom);
    toast.success(
      single
        ? `Price updated for ${products[0].sku}`
        : `Prices updated for ${payload.length} SKUs`,
      {
        description: `Effective ${effectiveFrom} on ${selectedList?.name ?? "list"} — prior invoices keep old line prices`,
      }
    );
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title={single ? `Update price — ${products[0].sku}` : `Update price — ${products.length} SKUs`}
      description={
        single
          ? products[0].name
          : "Set rates for the selected products only. Other SKUs are unchanged."
      }
      wide={!single}
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Price list</Label>
            <Select
              value={priceListId}
              onChange={(e) => setPriceListId(e.target.value)}
              disabled={!priceLists.length}
            >
              {!priceLists.length && <option value="">No lists</option>}
              {priceLists.map((pl) => (
                <option key={pl.id} value={pl.id}>
                  {pl.name} ({pl.code}){pl.isDefault ? " — default" : ""}
                </option>
              ))}
            </Select>
            <ErrorText message={errors.priceListId} />
          </div>
          <div className="space-y-2">
            <Label>Effective from</Label>
            <Input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
            <ErrorText message={errors.effectiveFrom} />
          </div>
        </div>

        {single ? (
          <div className="space-y-2">
            <Label>New rate (NPR)</Label>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={rates[products[0].id] ?? ""}
              onChange={(e) =>
                setRates((r) => ({ ...r, [products[0].id]: e.target.value }))
              }
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Current resolved: {formatNPR(resolveUnitPrice({ productId: products[0].id }))}
            </p>
            <ErrorText message={errors[`rate_${products[0].id}`]} />
          </div>
        ) : (
          <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-border p-3">
            {products.map((p) => (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-3 border-b border-border py-2 last:border-0"
              >
                <div className="min-w-[140px] flex-1">
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">{p.sku}</p>
                </div>
                <div className="w-28 space-y-1">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={rates[p.id] ?? ""}
                    onChange={(e) =>
                      setRates((r) => ({ ...r, [p.id]: e.target.value }))
                    }
                    aria-label={`Rate for ${p.sku}`}
                  />
                  <ErrorText message={errors[`rate_${p.id}`]} />
                </div>
              </div>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Writes a dated rate on the selected list for these SKUs only. Issued invoices keep
          snapshot prices; new sales pick up the rate from the effective date.
        </p>

        <FormActions
          onCancel={() => onOpenChange(false)}
          label={single ? "Update Price" : `Update ${products.length} Prices`}
        />
      </form>
    </FormDialogShell>
  );
}

export function InviteUserDialog({
  open,
  onOpenChange,
  tenantId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId?: string;
}) {
  const addUser = useAppStore((s) => s.addUser);
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [inheritFeatures, setInheritFeatures] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureKey[]>([...STORE_ACCESS_FEATURES]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "SALES",
    password: "",
    confirm: "",
  });

  const reset = () => {
    setForm({ name: "", email: "", role: "SALES", password: "", confirm: "" });
    setErrors({});
    setShowPass(false);
    setCanEdit(true);
    setCanDelete(false);
    setInheritFeatures(true);
    setSelectedFeatures([...STORE_ACCESS_FEATURES]);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match";
    if (!inheritFeatures && selectedFeatures.length === 0) {
      next.features = "Select at least one module";
    }
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const privileged = form.role === "OWNER" || form.role === "ADMIN";
      const created = addUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
        tenantId,
        managedTenantIds: [],
        enabledFeatures: privileged || inheritFeatures ? null : selectedFeatures,
        canEdit: privileged ? true : canEdit,
        canDelete: privileged ? true : canDelete,
      });
      toast.success("User created", {
        description: `${created.name} can sign in with their password`,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    }
  };

  const privilegedRole = form.role === "OWNER" || form.role === "ADMIN";

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Create User"
      description="Add a team member with email, password, and module access"
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Hari Bahadur"
            autoFocus
          />
          <ErrorText message={errors.name} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="hari@glamonepal.com"
          />
          <ErrorText message={errors.email} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Admin</option>
            <option value="SALES">Sales</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="USER">User</option>
          </Select>
        </div>
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          showPass={showPass}
          onShowPassChange={setShowPass}
          onPasswordChange={(password) => setForm((f) => ({ ...f, password }))}
          onConfirmChange={(confirm) => setForm((f) => ({ ...f, confirm }))}
          errors={errors}
        />
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Record permissions</p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={privilegedRole || canEdit}
                disabled={privilegedRole}
                onChange={(e) => setCanEdit(e.target.checked)}
              />
              Can edit
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={privilegedRole || canDelete}
                disabled={privilegedRole}
                onChange={(e) => setCanDelete(e.target.checked)}
              />
              Can delete
            </label>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Module access</p>
          <p className="text-xs text-muted-foreground">
            {privilegedRole
              ? "Owners and admins always get full store access."
              : "Choose which screens this user can open."}
          </p>
          {!privilegedRole && (
            <>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={inheritFeatures}
                  onChange={(e) => setInheritFeatures(e.target.checked)}
                />
                Full access (all modules)
              </label>
              {!inheritFeatures && (
                <div className="grid gap-2 sm:grid-cols-2">
                  {STORE_ACCESS_FEATURES.map((key) => (
                    <label key={key} className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={selectedFeatures.includes(key)}
                        onChange={(e) => {
                          setSelectedFeatures((prev) =>
                            e.target.checked
                              ? [...prev, key]
                              : prev.filter((f) => f !== key)
                          );
                        }}
                      />
                      {featureLabel(key)}
                    </label>
                  ))}
                </div>
              )}
              <ErrorText message={errors.features} />
            </>
          )}
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Create User" />
      </form>
    </FormDialogShell>
  );
}

export function EditUserAccessDialog({
  open,
  onOpenChange,
  userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
}) {
  const users = useAppStore((s) => s.users);
  const setUserFeatures = useAppStore((s) => s.setUserFeatures);
  const user = users.find((u) => u.id === userId) ?? null;
  const privileged =
    user?.role === "OWNER" || user?.role === "ADMIN" || user?.role === "PLATFORM_ADMIN";

  const [inheritFeatures, setInheritFeatures] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<FeatureKey[]>([...STORE_ACCESS_FEATURES]);

  useEffect(() => {
    if (!open || !user) return;
    if (user.enabledFeatures == null) {
      setInheritFeatures(true);
      setSelectedFeatures([...STORE_ACCESS_FEATURES]);
    } else {
      setInheritFeatures(false);
      setSelectedFeatures(
        STORE_ACCESS_FEATURES.filter((k) => user.enabledFeatures!.includes(k))
      );
    }
  }, [open, user]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!user || privileged) {
      onOpenChange(false);
      return;
    }
    if (!inheritFeatures && selectedFeatures.length === 0) {
      toast.error("Select at least one module");
      return;
    }
    setUserFeatures(user.id, inheritFeatures ? null : selectedFeatures);
    toast.success("Access updated", {
      description: inheritFeatures
        ? `${user.name} has full module access`
        : `${user.name} · ${selectedFeatures.length} modules`,
    });
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Module access"
      description={
        user
          ? privileged
            ? `${user.name} is an owner/admin and always has full access`
            : `Choose which modules ${user.name} can open`
          : "Choose modules"
      }
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        {privileged ? (
          <p className="text-sm text-muted-foreground">
            Owners and admins inherit every store module. Change their role if you need limited access.
          </p>
        ) : (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={inheritFeatures}
                onChange={(e) => setInheritFeatures(e.target.checked)}
              />
              Full access (all modules)
            </label>
            {!inheritFeatures && (
              <div className="grid gap-2 sm:grid-cols-2">
                {STORE_ACCESS_FEATURES.map((key) => (
                  <label key={key} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={selectedFeatures.includes(key)}
                      onChange={(e) => {
                        setSelectedFeatures((prev) =>
                          e.target.checked
                            ? [...prev, key]
                            : prev.filter((f) => f !== key)
                        );
                      }}
                    />
                    {featureLabel(key)}
                  </label>
                ))}
              </div>
            )}
          </div>
        )}
        <FormActions
          onCancel={() => onOpenChange(false)}
          label={privileged ? "Close" : "Save access"}
        />
      </form>
    </FormDialogShell>
  );
}

function PasswordFields({
  password,
  confirm,
  showPass,
  onShowPassChange,
  onPasswordChange,
  onConfirmChange,
  errors,
  passwordLabel = "Password",
}: {
  password: string;
  confirm: string;
  showPass: boolean;
  onShowPassChange: (v: boolean) => void;
  onPasswordChange: (v: string) => void;
  onConfirmChange: (v: string) => void;
  errors: FieldError;
  passwordLabel?: string;
}) {
  return (
    <>
      <div className="space-y-2">
        <Label>{passwordLabel}</Label>
        <div className="relative">
          <Input
            type={showPass ? "text" : "password"}
            value={password}
            onChange={(e) => onPasswordChange(e.target.value)}
            placeholder="Min. 6 characters"
            className="pr-9"
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => onShowPassChange(!showPass)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPass ? "Hide password" : "Show password"}
          >
            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <ErrorText message={errors.password} />
      </div>
      <div className="space-y-2">
        <Label>Confirm password</Label>
        <Input
          type={showPass ? "text" : "password"}
          value={confirm}
          onChange={(e) => onConfirmChange(e.target.value)}
          placeholder="Re-enter password"
          autoComplete="new-password"
        />
        <ErrorText message={errors.confirm} />
      </div>
    </>
  );
}

export function CreateClientDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated?: (tenantId: string) => void;
}) {
  const addTenant = useAppStore((s) => s.addTenant);
  const addUser = useAppStore((s) => s.addUser);
  const users = useAppStore((s) => s.users);
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name: "",
    shortName: "",
    ownerName: "",
    email: "",
    password: "",
    confirm: "",
    vatEnabled: true,
  });

  const reset = () => {
    setForm({
      name: "",
      shortName: "",
      ownerName: "",
      email: "",
      password: "",
      confirm: "",
      vatEnabled: true,
    });
    setErrors({});
    setShowPass(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    const email = form.email.trim().toLowerCase();
    if (!form.name.trim()) next.name = "Company name is required";
    if (!form.ownerName.trim()) next.ownerName = "Owner/admin name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    else if (users.some((u) => u.email === email)) next.email = "A user with this email already exists";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const created = addTenant({
        name: form.name.trim(),
        shortName: form.shortName.trim() || undefined,
        vatEnabled: form.vatEnabled,
      });
      addUser({
        name: form.ownerName.trim(),
        email,
        role: "OWNER",
        password: form.password,
        tenantId: created.id,
        managedTenantIds: [],
        enabledFeatures: null,
        active: true,
      });
      toast.success("Client created", {
        description: `${created.shortName} · login: ${email}`,
      });
      reset();
      onOpenChange(false);
      onCreated?.(created.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create client");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Add Client"
      description="Create a company tenant and its first owner login in one step. You can enable modules afterward."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Company name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Kathmandu Retail Traders Pvt. Ltd."
            autoFocus
          />
          <ErrorText message={errors.name} />
        </div>
        <div className="space-y-2">
          <Label>
            Short name <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Input
            value={form.shortName}
            onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))}
            placeholder="Defaults to company name"
          />
          <p className="text-xs text-muted-foreground">
            Shown in lists and navigation. New clients start with the starter feature set.
          </p>
        </div>
        <div className="flex items-start gap-3 rounded-xl border border-border bg-muted/30 px-4 py-3">
          <Checkbox
            checked={form.vatEnabled}
            onChange={(e) => setForm((f) => ({ ...f, vatEnabled: e.target.checked }))}
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">VAT service</p>
            <p className="text-xs text-muted-foreground">
              Charge 13% VAT on invoices, orders, and counter sales. Turn off for non-VAT clients.
            </p>
          </div>
          {form.vatEnabled ? (
            <Badge variant="success">On</Badge>
          ) : (
            <Badge variant="muted">Off</Badge>
          )}
        </div>
        <div className="space-y-2">
          <Label>Owner / admin name</Label>
          <Input
            value={form.ownerName}
            onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
            placeholder="Company owner name"
          />
          <ErrorText message={errors.ownerName} />
        </div>
        <div className="space-y-2">
          <Label>Email / username</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="owner@company.com.np"
            autoComplete="off"
          />
          <ErrorText message={errors.email} />
        </div>
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          showPass={showPass}
          onShowPassChange={setShowPass}
          onPasswordChange={(password) => setForm((f) => ({ ...f, password }))}
          onConfirmChange={(confirm) => setForm((f) => ({ ...f, confirm }))}
          errors={errors}
        />
        <FormActions onCancel={() => onOpenChange(false)} label="Add Client" />
      </form>
    </FormDialogShell>
  );
}

export function CreateAdminDialog({
  open,
  onOpenChange,
  tenants: tenantsProp,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** When provided, limits assignable clients (managed tenants). */
  tenants?: { id: string; shortName: string }[];
}) {
  const addUser = useAppStore((s) => s.addUser);
  const allTenants = useAppStore((s) => s.tenants);
  const tenants = tenantsProp ?? allTenants;
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    tenantId: tenants[0]?.id ?? "",
    role: "OWNER",
  });

  useEffect(() => {
    if (open && tenants.length && !form.tenantId) {
      setForm((f) => ({ ...f, tenantId: tenants[0].id }));
    }
  }, [open, tenants, form.tenantId]);

  const reset = () => {
    setForm({
      name: "",
      email: "",
      password: "",
      confirm: "",
      tenantId: tenants[0]?.id ?? "",
      role: "OWNER",
    });
    setErrors({});
    setShowPass(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (!form.tenantId) next.tenantId = "Select a client";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const created = addUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
        tenantId: form.tenantId,
        managedTenantIds: [],
        enabledFeatures: null,
      });
      const tenant = tenants.find((t) => t.id === form.tenantId);
      toast.success("Client admin created", {
        description: `${created.name} · ${tenant?.shortName ?? "client"}`,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create admin");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Create Client Admin"
      description="Create an owner or company admin for a client workspace (Client login)"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Full Name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Company admin name"
            autoFocus
          />
          <ErrorText message={errors.name} />
        </div>
        <div className="space-y-2">
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="admin@company.com.np"
          />
          <ErrorText message={errors.email} />
        </div>
        <div className="space-y-2">
          <Label>Assign to client</Label>
          <Select
            value={form.tenantId}
            onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.shortName}
              </option>
            ))}
          </Select>
          <ErrorText message={errors.tenantId} />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select
            value={form.role}
            onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
          >
            <option value="OWNER">Owner</option>
            <option value="ADMIN">Company admin</option>
          </Select>
          <p className="text-xs text-muted-foreground">
            Client-scoped roles use Client login and cannot access the platform Admin panel.
          </p>
        </div>
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          showPass={showPass}
          onShowPassChange={setShowPass}
          onPasswordChange={(password) => setForm((f) => ({ ...f, password }))}
          onConfirmChange={(confirm) => setForm((f) => ({ ...f, confirm }))}
          errors={errors}
        />
        <FormActions onCancel={() => onOpenChange(false)} label="Create Admin" />
      </form>
    </FormDialogShell>
  );
}

export function CreateCompanyUserDialog({
  open,
  onOpenChange,
  tenantId,
  tenantFeatures,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  tenantId: string;
  tenantFeatures: string[];
}) {
  const addUser = useAppStore((s) => s.addUser);
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [inheritFeatures, setInheritFeatures] = useState(true);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [canEdit, setCanEdit] = useState(true);
  const [canDelete, setCanDelete] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    role: "SALES",
    password: "",
    confirm: "",
  });

  const reset = () => {
    setForm({ name: "", email: "", role: "SALES", password: "", confirm: "" });
    setErrors({});
    setShowPass(false);
    setInheritFeatures(true);
    setSelectedFeatures([]);
    setCanEdit(true);
    setCanDelete(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Name is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = "Enter a valid email";
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length) return;

    try {
      const privileged = form.role === "OWNER" || form.role === "ADMIN";
      const created = addUser({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        role: form.role,
        password: form.password,
        tenantId,
        enabledFeatures: inheritFeatures
          ? null
          : (selectedFeatures.filter((f) => tenantFeatures.includes(f)) as FeatureKey[]),
        managedTenantIds: [],
        canEdit: privileged ? true : canEdit,
        canDelete: privileged ? true : canDelete,
      });
      toast.success("User created", {
        description: `${created.name} · ${created.role}`,
      });
      reset();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create user");
    }
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Create User"
      description="Add a user for this company with email, password, and access"
      wide
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="Team member name"
              autoFocus
            />
            <ErrorText message={errors.name} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="user@company.com.np"
            />
            <ErrorText message={errors.email} />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
            <option value="ADMIN">Admin</option>
            <option value="OWNER">Owner</option>
            <option value="SALES">Sales</option>
            <option value="ACCOUNTANT">Accountant</option>
            <option value="USER">User</option>
          </Select>
        </div>
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          showPass={showPass}
          onShowPassChange={setShowPass}
          onPasswordChange={(password) => setForm((f) => ({ ...f, password }))}
          onConfirmChange={(confirm) => setForm((f) => ({ ...f, confirm }))}
          errors={errors}
        />
        <div className="space-y-3 rounded-xl border border-border p-4">
          <p className="text-sm font-medium">Record permissions</p>
          <p className="text-xs text-muted-foreground">
            Control whether this user can edit or delete records (owners/admins always can).
          </p>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.role === "OWNER" || form.role === "ADMIN" || canEdit}
                disabled={form.role === "OWNER" || form.role === "ADMIN"}
                onChange={(e) => setCanEdit(e.target.checked)}
              />
              Can edit
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.role === "OWNER" || form.role === "ADMIN" || canDelete}
                disabled={form.role === "OWNER" || form.role === "ADMIN"}
                onChange={(e) => setCanDelete(e.target.checked)}
              />
              Can delete
            </label>
          </div>
        </div>
        <div className="space-y-3 rounded-xl border border-border p-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={inheritFeatures}
              onChange={(e) => setInheritFeatures(e.target.checked)}
              className="rounded border-border"
            />
            Inherit all company features
          </label>
          {!inheritFeatures && (
            <div className="grid gap-2 sm:grid-cols-2">
              {tenantFeatures.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedFeatures.includes(key)}
                    onChange={(e) => {
                      setSelectedFeatures((prev) =>
                        e.target.checked ? [...prev, key] : prev.filter((f) => f !== key)
                      );
                    }}
                    className="rounded border-border"
                  />
                  {featureLabel(key)}
                </label>
              ))}
            </div>
          )}
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Create User" />
      </form>
    </FormDialogShell>
  );
}

export function ResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userName,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string | null;
  userName?: string;
}) {
  const setUserPassword = useAppStore((s) => s.setUserPassword);
  const [errors, setErrors] = useState<FieldError>({});
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({ password: "", confirm: "" });

  const reset = () => {
    setForm({ password: "", confirm: "" });
    setErrors({});
    setShowPass(false);
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    const next: FieldError = {};
    if (form.password.length < 6) next.password = "Password must be at least 6 characters";
    if (form.password !== form.confirm) next.confirm = "Passwords do not match";
    setErrors(next);
    if (Object.keys(next).length) return;

    const updated = setUserPassword(userId, form.password);
    if (!updated) {
      toast.error("Could not update password");
      return;
    }
    toast.success("Password updated", {
      description: userName ? `New password set for ${userName}` : undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Reset password"
      description={userName ? `Set a new password for ${userName}` : "Set a new password"}
    >
      <form onSubmit={submit} className="space-y-4">
        <PasswordFields
          password={form.password}
          confirm={form.confirm}
          showPass={showPass}
          onShowPassChange={setShowPass}
          onPasswordChange={(password) => setForm((f) => ({ ...f, password }))}
          onConfirmChange={(confirm) => setForm((f) => ({ ...f, confirm }))}
          errors={errors}
          passwordLabel="New password"
        />
        <FormActions onCancel={() => onOpenChange(false)} label="Save password" />
      </form>
    </FormDialogShell>
  );
}

export function CreateBranchDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addBranch = useAppStore((s) => s.addBranch);
  const [errors, setErrors] = useState<FieldError>({});
  const [form, setForm] = useState({ name: "", code: "", pan: "601234567" });

  const reset = () => {
    setForm({ name: "", code: "", pan: "601234567" });
    setErrors({});
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const next: FieldError = {};
    if (!form.name.trim()) next.name = "Branch name is required";
    if (!form.code.trim() || form.code.trim().length < 2) next.code = "Code must be at least 2 characters";
    if (!form.pan.trim()) next.pan = "PAN is required";
    setErrors(next);
    if (Object.keys(next).length) return;

    const created = addBranch({
      name: form.name.trim(),
      code: form.code.trim(),
      pan: form.pan.trim(),
      active: true,
    });
    toast.success("Branch added", { description: `${created.name} (${created.code})` });
    reset();
    onOpenChange(false);
  };

  return (
    <FormDialogShell
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
      title="Add Branch"
      description="Register a new operating location"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-2">
          <Label>Branch Name</Label>
          <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Koteshwor Depot" autoFocus />
          <ErrorText message={errors.name} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Code</Label>
            <Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} placeholder="KTS" />
            <ErrorText message={errors.code} />
          </div>
          <div className="space-y-2">
            <Label>PAN</Label>
            <Input value={form.pan} onChange={(e) => setForm((f) => ({ ...f, pan: e.target.value }))} />
            <ErrorText message={errors.pan} />
          </div>
        </div>
        <FormActions onCancel={() => onOpenChange(false)} label="Add Branch" />
      </form>
    </FormDialogShell>
  );
}
