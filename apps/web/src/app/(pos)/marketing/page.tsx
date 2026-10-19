"use client";

import { useState } from "react";
import { Loader2, Mail, Send, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { campaignsApi, type Campaign, type CampaignAudience } from "@/lib/api/campaigns";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDateTime, formatNumber } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";

const AUDIENCES: Array<{ key: CampaignAudience; label: string; hint: string }> = [
  { key: "customers", label: "Opted-in customers", hint: "Bought from you and agreed to offers" },
  { key: "subscribers", label: "Newsletter", hint: "People who joined the email list" },
  { key: "all", label: "Everyone", hint: "Both lists, duplicates removed" },
];

const STATUS: Record<Campaign["status"], { label: string; variant: "muted" | "warning" | "success" | "danger" }> = {
  draft: { label: "Draft", variant: "muted" },
  sending: { label: "Sending", variant: "warning" },
  sent: { label: "Sent", variant: "success" },
  failed: { label: "Failed", variant: "danger" },
};

export default function MarketingPage() {
  const user = useAuthStore((s) => s.user);
  const canWrite = useAuthStore((s) => s.permissions.includes("settings.write"));
  const audienceQ = useApi(() => campaignsApi.audience(), []);
  const listQ = useApi(() => campaignsApi.list(), []);

  const [subject, setSubject] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [body, setBody] = useState("");
  const [audience, setAudience] = useState<CampaignAudience>("customers");
  const [busy, setBusy] = useState<"test" | "draft" | "send" | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  const counts = audienceQ.data;
  const recipients = counts?.[audience] ?? 0;
  const valid = subject.trim().length >= 3 && body.trim().length >= 10;
  const input = () => ({ subject: subject.trim(), previewText: previewText.trim(), body: body.trim(), audience });

  const refresh = async () => {
    await Promise.all([audienceQ.reload(), listQ.reload()]);
  };

  const sendTest = async () => {
    if (!valid) return toast.error("Add a subject and a message first.");
    setBusy("test");
    setLastError(null);
    try {
      const res = await campaignsApi.sendTest({ ...input(), to: user?.email });
      toast.success(`Test sent to ${res.to}`);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      toastError(err, "Couldn't send the test");
    } finally {
      setBusy(null);
    }
  };

  const saveDraft = async () => {
    if (!valid) return toast.error("Add a subject and a message first.");
    setBusy("draft");
    setLastError(null);
    try {
      await campaignsApi.create(input());
      toast.success("Draft saved.");
      await refresh();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      toastError(err, "Couldn't save the draft");
    } finally {
      setBusy(null);
    }
  };

  const sendNow = async () => {
    setConfirmOpen(false);
    setBusy("send");
    setLastError(null);
    try {
      const draft = await campaignsApi.create(input());
      const result = await campaignsApi.send(draft.id);
      if (result.sent > 0) toast.success(`Sent to ${formatNumber(result.sent)} people.`);
      else toast.error("Nothing was delivered. Check the campaign error.");
      if (result.failed > 0) toast.warning(`${formatNumber(result.failed)} addresses failed.`);
      setLastError(result.error);
      await refresh();
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      toastError(err, "Couldn't send the campaign");
    } finally {
      setBusy(null);
    }
  };

  const campaigns = listQ.data ?? [];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Email campaigns"
        description="Write once, send from info@glamonepal.com to people who asked to hear from you."
        actions={
          <Badge variant="outline" className="h-8 gap-1.5 px-3">
            <Mail className="h-3.5 w-3.5" aria-hidden /> info@glamonepal.com
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Compose</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Field label="Subject" hint="What lands in the inbox — keep it under 60 characters.">
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} placeholder="New arrivals: glow season is here" disabled={!canWrite || busy !== null} />
            </Field>
            <Field label="Preview text" hint="The grey line next to the subject. Optional.">
              <Input value={previewText} onChange={(e) => setPreviewText(e.target.value)} maxLength={200} placeholder="A first look at the new serum everyone asked about." disabled={!canWrite || busy !== null} />
            </Field>
            <Field label="Message" hint="Plain text. Blank lines become paragraphs; we add the branding and unsubscribe line.">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={12}
                maxLength={20000}
                placeholder={"Hi there,\n\nThe new arrivals are live. Authentic products, delivered across Nepal.\n\nWith love,\nGLAMO"}
                disabled={!canWrite || busy !== null}
                className="min-h-56 resize-y text-sm leading-relaxed"
              />
            </Field>

            <div>
              <p className="mb-2 text-sm font-medium">Audience</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {AUDIENCES.map((a) => {
                  const active = audience === a.key;
                  return (
                    <button
                      key={a.key}
                      type="button"
                      aria-pressed={active}
                      disabled={!canWrite || busy !== null}
                      onClick={() => setAudience(a.key)}
                      className={cn(
                        "flex min-h-24 flex-col justify-between gap-2 rounded-xl border p-3 text-left transition-colors disabled:opacity-60",
                        active ? "border-rose bg-rose-tint" : "border-border hover:border-rose",
                      )}
                    >
                      <span className="text-sm font-semibold">{a.label}</span>
                      <span className="text-xs text-muted-foreground">{a.hint}</span>
                      <span className="text-lg font-semibold tabular">{counts ? formatNumber(counts[a.key]) : "—"}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {lastError && (
              <div className="rounded-lg border border-danger/40 bg-danger/5 px-3 py-2 text-sm text-danger" role="alert">
                {lastError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button variant="brand" onClick={() => setConfirmOpen(true)} disabled={!canWrite || !valid || busy !== null || recipients === 0}>
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Send className="h-4 w-4" aria-hidden />}
                Send to {counts ? formatNumber(recipients) : "…"}
              </Button>
              <Button variant="outline" onClick={sendTest} disabled={!canWrite || !valid || busy !== null}>
                {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
                Send a test
              </Button>
              <Button variant="ghost" onClick={saveDraft} disabled={!canWrite || !valid || busy !== null}>
                {busy === "draft" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Save draft
              </Button>
              {!canWrite && <span className="text-xs text-muted-foreground">Only an owner or manager can send.</span>}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><Users className="h-4 w-4" aria-hidden /> Who receives it</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {audienceQ.error ? (
                <ErrorPanel error={audienceQ.error} onRetry={audienceQ.reload} />
              ) : audienceQ.loading && !counts ? (
                <LoadingRows rows={3} />
              ) : (
                <>
                  <Row label="Opted-in customers" value={counts?.customers ?? 0} />
                  <Row label="Newsletter" value={counts?.subscribers ?? 0} />
                  <Row label="After de-duplication" value={counts?.all ?? 0} strong />
                  <p className="pt-1 text-xs text-muted-foreground">People who unsubscribed are excluded automatically. Only addresses that consented are emailed.</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Recent campaigns</CardTitle>
            </CardHeader>
            <CardContent>
              {listQ.error ? (
                <ErrorPanel error={listQ.error} onRetry={listQ.reload} />
              ) : listQ.loading && !listQ.data ? (
                <LoadingRows rows={4} />
              ) : campaigns.length ? (
                <ul className="divide-y divide-border/60">
                  {campaigns.slice(0, 8).map((c) => (
                    <li key={c.id} className="py-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 truncate text-sm font-medium">{c.subject}</p>
                        <Badge variant={STATUS[c.status]?.variant ?? "muted"}>{STATUS[c.status]?.label ?? c.status}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {c.audienceLabel} · {c.sentAt || c.createdAt ? formatDateTime((c.sentAt ?? c.createdAt) as string) : "Not sent"}
                      </p>
                      <p className="mt-1 text-xs tabular">
                        {c.status === "sent" ? `${formatNumber(c.sentCount)} sent` : `${formatNumber(c.recipientCount)} recipients`}
                        {c.failedCount > 0 && <span className="text-danger"> · {formatNumber(c.failedCount)} failed</span>}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No campaigns yet. Your first send will appear here.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} label="Send campaign" className="max-w-md">
        <DialogContent onClose={() => setConfirmOpen(false)}>
          <DialogHeader>
            <DialogTitle>Send this campaign?</DialogTitle>
            <DialogDescription>
              It goes to {formatNumber(recipients)} people in “{AUDIENCES.find((a) => a.key === audience)?.label}” right now. Email cannot be unsent.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{subject}</p>
            <p className="mt-1 line-clamp-2 text-muted-foreground">{body}</p>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="brand" onClick={sendNow}>
              <Send className="h-4 w-4" aria-hidden /> Send now
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-border/50 pb-2 last:border-0 last:pb-0">
      <span className={cn("text-muted-foreground", strong && "font-medium text-foreground")}>{label}</span>
      <span className={cn("tabular", strong ? "text-lg font-semibold" : "font-medium")}>{formatNumber(value)}</span>
    </div>
  );
}
