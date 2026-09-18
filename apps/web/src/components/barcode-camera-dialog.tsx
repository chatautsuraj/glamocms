"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDetected: (code: string) => void;
};

export function BarcodeCameraDialog({ open, onOpenChange, onDetected }: Props) {
  const reactId = useId().replace(/:/g, "");
  const regionId = `glamo-cam-scan-${reactId}`;
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const handledRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError(null);
    setStarting(true);

    let cancelled = false;
    const scanner = new Html5Qrcode(regionId, {
      formatsToSupport: [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.EAN_13,
        Html5QrcodeSupportedFormats.EAN_8,
        Html5QrcodeSupportedFormats.UPC_A,
        Html5QrcodeSupportedFormats.UPC_E,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.QR_CODE,
      ],
      verbose: false,
    });
    scannerRef.current = scanner;

    const start = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 260, height: 140 }, aspectRatio: 1.777 },
          (decoded) => {
            if (cancelled || handledRef.current) return;
            const code = decoded.trim();
            if (!code) return;
            handledRef.current = true;
            onDetected(code);
            onOpenChange(false);
          },
          () => {
            /* ignore frame miss */
          },
        );
        if (!cancelled) setStarting(false);
      } catch (e) {
        if (cancelled) return;
        setStarting(false);
        setError(
          e instanceof Error
            ? e.message
            : "Camera unavailable — allow camera permission or use HTTPS / localhost",
        );
      }
    };

    void start();

    return () => {
      cancelled = true;
      const s = scannerRef.current;
      scannerRef.current = null;
      if (!s) return;
      void (async () => {
        try {
          if (s.isScanning) await s.stop();
        } catch {
          /* ignore */
        }
        try {
          s.clear();
        } catch {
          /* ignore */
        }
      })();
    };
  }, [open, regionId, onDetected, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogContent className="relative" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Scan with camera
          </DialogTitle>
          <DialogDescription>
            Point the phone camera at the stock barcode / SKU label
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <div id={regionId} className="min-h-[240px] w-full" />
        </div>

        {starting && !error && (
          <p className="text-center text-sm text-muted-foreground">Starting camera…</p>
        )}
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
