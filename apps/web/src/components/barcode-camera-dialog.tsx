"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!open) return;
    handledRef.current = false;
    setError(null);
    setStarting(true);
    setManual("");

    let cancelled = false;
    let scanner: Html5Qrcode | null = null;

    // Wait for dialog DOM + mobile camera permission UI
    const timer = window.setTimeout(() => {
      void (async () => {
        const el = document.getElementById(regionId);
        if (!el) {
          if (!cancelled) {
            setStarting(false);
            setError("Scanner view not ready — try again or type the code below.");
          }
          return;
        }

        try {
          scanner = new Html5Qrcode(regionId, {
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

          let cameraConfig: string | MediaTrackConstraints = {
            facingMode: { ideal: "environment" },
          };
          try {
            const cams = await Html5Qrcode.getCameras();
            if (cams.length) {
              const back =
                cams.find((c) => /back|rear|environment|wide/i.test(c.label)) ??
                cams[cams.length - 1];
              if (back?.id) cameraConfig = back.id;
            }
          } catch {
            /* use facingMode */
          }

          const boxW = Math.max(180, Math.min(280, Math.floor(window.innerWidth * 0.72)));
          const boxH = Math.max(100, Math.floor(boxW * 0.5));

          await scanner.start(
            cameraConfig,
            {
              fps: 12,
              qrbox: { width: boxW, height: boxH },
              aspectRatio: 1.333,
              disableFlip: false,
            },
            (decoded) => {
              if (cancelled || handledRef.current) return;
              const code = decoded.trim();
              if (!code) return;
              handledRef.current = true;
              onDetected(code);
              onOpenChange(false);
            },
            () => {
              /* frame miss */
            },
          );
          if (!cancelled) setStarting(false);
        } catch (e) {
          if (cancelled) return;
          setStarting(false);
          const msg = e instanceof Error ? e.message : String(e);
          setError(
            /NotAllowed|Permission|denied/i.test(msg)
              ? "Camera permission blocked. Allow camera for this site, or type the SKU / barcode below."
              : /NotFound|no camera|DevicesNotFound/i.test(msg)
                ? "No camera found. Type the SKU / barcode below."
                : `${msg} — you can still type the code below.`,
          );
        }
      })();
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      const s = scannerRef.current ?? scanner;
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

  const submitManual = () => {
    const code = manual.trim();
    if (!code) return;
    handledRef.current = true;
    onDetected(code);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} className="max-w-md">
      <DialogContent className="relative" onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" /> Scan with camera
          </DialogTitle>
          <DialogDescription>
            Use the rear camera on your phone. Hold steady over the stock barcode / SKU.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-black">
          <div id={regionId} className="min-h-[240px] w-full [&_video]:!h-auto [&_video]:!w-full" />
        </div>

        {starting && !error && (
          <p className="text-center text-sm text-muted-foreground">
            Starting camera… allow permission if asked
          </p>
        )}
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="space-y-2 border-t border-border pt-3">
          <Label htmlFor="manual-barcode">Or type SKU / barcode</Label>
          <div className="flex gap-2">
            <Input
              id="manual-barcode"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="Scan failed? Type code here"
              autoComplete="off"
              inputMode="text"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitManual();
                }
              }}
            />
            <Button type="button" onClick={submitManual} disabled={!manual.trim()}>
              Add
            </Button>
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
