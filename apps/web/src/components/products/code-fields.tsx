"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { catalogApi } from "@/lib/api/catalog";
import { ApiError, ERROR_COPY } from "@/lib/api/errors";
import { toastError } from "@/lib/notify";

export type CodeErrors = { barcode?: string; sku?: string; salePrice?: string };

/** Map server code problems onto the form fields they belong to (null = not a field error). */
export function codeFieldErrors(err: unknown): CodeErrors | null {
  if (!(err instanceof ApiError)) return null;
  switch (err.code) {
    case "BARCODE_TAKEN":
    case "INVALID_BARCODE":
      return { barcode: ERROR_COPY[err.code] };
    case "SKU_TAKEN":
    case "INVALID_SKU":
      return { sku: ERROR_COPY[err.code] };
    case "INVALID_SALE_PRICE":
      return { salePrice: ERROR_COPY[err.code] };
    default:
      return null;
  }
}

/** Barcode + SKU inputs. "Generate" reserves the next in-store EAN-13; an empty SKU is created automatically. */
export function CodeFields({ barcode, sku, onBarcode, onSku, errors, existing }: {
  barcode: string;
  sku: string;
  onBarcode: (v: string) => void;
  onSku: (v: string) => void;
  errors: CodeErrors;
  /** Editing an existing item: an empty field means "make a new one". */
  existing?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const generate = async () => {
    setBusy(true);
    try {
      onBarcode((await catalogApi.nextBarcode()).barcode);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Field label="Barcode" error={errors.barcode} hint={existing ? "Scan the box barcode, or press Generate for a new shop barcode." : "Scan the box barcode, or leave empty and one is created."}>
        <div className="flex gap-2">
          <Input value={barcode} onChange={(e) => onBarcode(e.target.value.trim())} className="tabular font-mono" autoComplete="off" spellCheck={false} aria-invalid={Boolean(errors.barcode)} placeholder="Created automatically" />
          <Button variant="outline" onClick={() => void generate()} disabled={busy}>
            <Wand2 className="h-4 w-4" aria-hidden /> {busy ? "…" : "Generate"}
          </Button>
        </div>
      </Field>
      <Field label="SKU" error={errors.sku} hint="Leave empty and one is created.">
        <Input value={sku} onChange={(e) => onSku(e.target.value)} className="font-mono" autoComplete="off" spellCheck={false} aria-invalid={Boolean(errors.sku)} placeholder="Created automatically" />
      </Field>
    </>
  );
}
