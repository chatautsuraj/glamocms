"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Expand, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useModalLayer } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatNPR } from "@/lib/format";
import type { PaymentAccount } from "@/lib/pos/payments";
import { cn } from "@/lib/utils";

function QrImage({ src, title, className }: { src: string; title: string; className?: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- uploaded QR (Cloudinary); must stay pixel-exact, no optimisation
    <img
      src={src}
      alt={`${title} QR code`}
      onError={() => setFailed(true)}
      className={cn("mx-auto block aspect-square h-auto w-full rounded-xl bg-white object-contain p-3 [image-rendering:crisp-edges]", className)}
    />
  );
}

function AccountDetails({ account, large }: { account: PaymentAccount; large?: boolean }) {
  return (
    <dl className={cn("space-y-2", large && "space-y-3")}>
      {account.accountName && (
        <div>
          <dt className="text-xs font-medium text-muted-foreground">Account name</dt>
          <dd className={cn("font-semibold", large ? "text-2xl" : "text-lg")}>{account.accountName}</dd>
        </div>
      )}
      {account.idValue && (
        <div>
          <dt className="text-xs font-medium text-muted-foreground">{account.idLabel}</dt>
          <dd className={cn("tabular font-mono font-bold tracking-wide", large ? "text-4xl" : "text-2xl")}>{account.idValue}</dd>
        </div>
      )}
      {account.extra.length > 0 && <dd className="text-sm text-muted-foreground">{account.extra.join(" · ")}</dd>}
    </dl>
  );
}

/**
 * Customer-facing payment screen for Fonepay / eSewa / Khalti / bank transfer:
 * the shop's QR as large as the screen allows, the amount in big type and the
 * account details. "Show to customer" fills the whole screen.
 */
export function PaymentScreen({ account, amount, reference, onReference, onReceived, onBack, busy, settingsHint }: {
  account: PaymentAccount;
  amount: number;
  reference: string;
  onReference: (v: string) => void;
  onReceived: () => void;
  onBack: () => void;
  busy?: boolean;
  /** Managers see where to add a missing QR; cashiers just see the number. */
  settingsHint: boolean;
}) {
  const [full, setFull] = useState(false);
  const fullRef = useRef<HTMLDivElement>(null);
  const receivedRef = useRef<HTMLButtonElement>(null);
  const hasQr = Boolean(account.qrImageUrl);
  const hasDetails = Boolean(account.idValue || account.accountName);

  useEffect(() => {
    receivedRef.current?.focus();
  }, []);

  useModalLayer(full, () => setFull(false), fullRef);

  // Real browser full screen where allowed (tablets turned to the customer).
  useEffect(() => {
    if (!full) return;
    fullRef.current?.requestFullscreen?.().catch(() => undefined);
    const onExit = () => {
      if (!document.fullscreenElement) setFull(false);
    };
    document.addEventListener("fullscreenchange", onExit);
    return () => {
      document.removeEventListener("fullscreenchange", onExit);
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, [full]);

  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,320px)]">
      <div className="flex min-h-[320px] items-center justify-center rounded-xl border border-border bg-white p-2 dark:bg-white">
        {hasQr ? (
          <QrImage src={account.qrImageUrl} title={account.title} className="max-h-[min(64dvh,640px)] min-h-[300px] w-auto max-w-full" />
        ) : (
          <div className="space-y-3 p-6 text-center text-ink-strong">
            <p className="text-sm font-medium text-[#5e5650]">Pay with {account.title} to</p>
            {account.idValue ? (
              <p className="tabular font-mono text-4xl font-bold tracking-wide sm:text-5xl">{account.idValue}</p>
            ) : (
              <p className="text-lg font-semibold">{account.accountName || `the shop's ${account.title} account`}</p>
            )}
            {account.idValue && account.accountName && <p className="text-xl font-semibold">{account.accountName}</p>}
            {settingsHint && (
              <p className="mx-auto max-w-xs rounded-lg bg-[#fbeff3] px-3 py-2 text-sm text-[#3d3530]">
                No QR code yet. Add it in <Link href="/settings?tab=payments" className="font-semibold underline">Settings → Payments</Link> so customers can scan.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{account.title} · amount to pay</p>
          <p className="tabular font-display text-5xl font-bold leading-tight">{formatNPR(amount)}</p>
        </div>
        {hasQr && hasDetails && <AccountDetails account={account} />}
        {!hasQr && account.extra.length > 0 && <p className="text-sm text-muted-foreground">{account.extra.join(" · ")}</p>}
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">Reference / transaction ID <span className="font-normal text-muted-foreground">(optional)</span></span>
          <Input value={reference} onChange={(e) => onReference(e.target.value)} onKeyDown={(e) => e.key === "Enter" && e.preventDefault()} autoComplete="off" placeholder="From the customer's app" />
        </label>
        <div className="mt-auto grid gap-2">
          <Button ref={receivedRef} variant="brand" size="xl" onClick={onReceived} disabled={busy} aria-busy={busy}>
            <CheckCircle2 className="h-5 w-5" aria-hidden /> {busy ? "Saving…" : "Payment received"}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onBack} disabled={busy}><ArrowLeft className="h-4 w-4" aria-hidden /> Back</Button>
            <Button variant="outline" onClick={() => setFull(true)}><Expand className="h-4 w-4" aria-hidden /> Show to customer</Button>
          </div>
        </div>
      </div>

      {full && (
        <div ref={fullRef} role="dialog" aria-modal="true" tabIndex={-1} aria-label={`${account.title} payment`} className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-white p-6 text-ink-strong" onClick={() => setFull(false)}>
          <p className="text-xl font-semibold text-[#5e5650]">Scan to pay with {account.title}</p>
          {hasQr ? (
            <QrImage src={account.qrImageUrl} title={account.title} className="max-h-[66dvh] w-auto max-w-[92vw] p-0" />
          ) : (
            account.idValue && <p className="tabular font-mono text-6xl font-bold tracking-wide">{account.idValue}</p>
          )}
          <p className="tabular font-display text-6xl font-bold sm:text-7xl">{formatNPR(amount)}</p>
          {(account.accountName || (hasQr && account.idValue)) && (
            <p className="text-center text-2xl font-semibold">
              {account.accountName}
              {hasQr && account.idValue ? <span className="tabular ml-3 font-mono text-[#5e5650]">{account.idValue}</span> : null}
            </p>
          )}
          <Button variant="outline" className="absolute right-4 top-4 border-[#ddd4d6] bg-white text-ink-strong hover:bg-[#f4eeef]" onClick={() => setFull(false)}>
            <Minimize2 className="h-4 w-4" aria-hidden /> Back to cashier
          </Button>
        </div>
      )}
    </div>
  );
}
