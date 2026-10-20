"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCheck, Megaphone, RefreshCw, Send, UserRound } from "lucide-react";
import { ErrorPanel, LoadingRows } from "@/components/loading";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { whatsappApi } from "@/lib/api/whatsapp";
import type { BroadcastResult, WaConversation } from "@/lib/api/types";
import { useAuthStore } from "@/lib/auth/auth-store";
import { formatDateTime } from "@/lib/format";
import { toastError } from "@/lib/notify";
import { cn } from "@/lib/utils";
import { useApi } from "@/lib/use-api";

export default function WhatsAppPage() {
  const canBroadcast = useAuthStore((s) => s.permissions.includes("whatsapp.broadcast"));
  const [status, setStatus] = useState<"open" | "handoff" | "all">("open");
  const [active, setActive] = useState<WaConversation | null>(null);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const list = useApi(() => whatsappApi.conversations(status), [status]);

  const reloadList = list.reload;
  useEffect(() => {
    const t = window.setInterval(() => void reloadList(), 30_000);
    return () => window.clearInterval(t);
  }, [reloadList]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp inbox"
        description="Customer chats from the shop WhatsApp number. Chats marked “needs a person” are waiting for staff."
        actions={canBroadcast && <Button variant="outline" onClick={() => setBroadcastOpen(true)}><Megaphone className="h-4 w-4" aria-hidden /> Send offer message</Button>}
      />
      {/* Below lg this is master/detail: the list, or one open chat with a way back — never both stacked. */}
      <div className="grid gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className={cn(active && "hidden lg:block")}>
          <CardContent className="space-y-3 p-3">
            <div className="flex gap-2">
              <Select aria-label="Conversation filter" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
                <option value="open">Open chats</option>
                <option value="handoff">Needs a person</option>
                <option value="all">All</option>
              </Select>
              <Button variant="ghost" size="icon" aria-label="Refresh conversations" onClick={() => void list.reload()}><RefreshCw className="h-4 w-4" /></Button>
            </div>
            {list.error ? <ErrorPanel error={list.error} onRetry={list.reload} /> : list.loading && !list.data ? <LoadingRows /> : (
              <ul className="max-h-[65vh] divide-y divide-border overflow-y-auto" aria-label="Conversations">
                {(list.data?.items ?? []).map((c) => (
                  <li key={c.waId}>
                    <button
                      type="button"
                      onClick={() => setActive(c)}
                      aria-current={active?.waId === c.waId ? "true" : undefined}
                      className={cn("w-full space-y-0.5 px-2 py-3 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", active?.waId === c.waId && "bg-accent")}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate font-medium">{c.name || c.phone}</span>
                        {c.handoff && <Badge variant="warning" className="shrink-0">Needs a person</Badge>}
                        {c.unread > 0 && <Badge variant="brand" className="shrink-0" aria-label={`${c.unread} unread`}>{c.unread}</Badge>}
                        <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">{c.lastAt && formatDateTime(c.lastAt)}</span>
                      </span>
                      <span className="line-clamp-1 block text-xs text-muted-foreground">{c.lastMessage}</span>
                    </button>
                  </li>
                ))}
                {!list.data?.items.length && <li className="py-8 text-center text-sm text-muted-foreground">No chats here.</li>}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card className={cn("min-w-0", !active && "hidden lg:block")}>
          <CardContent className="p-0">
            {active && (
              <button type="button" onClick={() => setActive(null)} className="flex min-h-11 w-full items-center gap-1 border-b border-border px-3 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring lg:hidden">
                <ArrowLeft className="h-4 w-4" aria-hidden /> All chats
              </button>
            )}
            {active ? <Thread key={active.waId} waId={active.waId} onChanged={() => void list.reload()} /> : <p className="p-10 text-center text-sm text-muted-foreground">Choose a chat from the list to read it and reply.</p>}
          </CardContent>
        </Card>
      </div>
      {canBroadcast && <BroadcastDialog open={broadcastOpen} onOpenChange={setBroadcastOpen} />}
    </div>
  );
}

function Thread({ waId, onChanged }: { waId: string; onChanged: () => void }) {
  const convo = useApi(() => whatsappApi.conversation(waId), [waId]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [convo.data?.messages.length]);
  const reloadConvo = convo.reload;
  useEffect(() => {
    const t = window.setInterval(() => void reloadConvo(), 15_000);
    return () => window.clearInterval(t);
  }, [reloadConvo]);
  const d = convo.data;
  if (convo.error) return <div className="p-4"><ErrorPanel error={convo.error} onRetry={convo.reload} /></div>;
  if (!d) return <div className="p-4"><LoadingRows /></div>;

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      await whatsappApi.reply(waId, text.trim());
      setText("");
      await convo.reload();
      onChanged();
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  const resolve = async () => {
    try {
      await whatsappApi.resolve(waId);
      toast.success("Marked done. Automatic replies take over again.");
      await convo.reload();
      onChanged();
    } catch (err) {
      toastError(err);
    }
  };

  return (
    <div className="flex h-[70vh] flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <UserRound className="h-5 w-5 text-muted-foreground" aria-hidden />
        <div>
          <p className="font-medium">{d.name || d.phone}</p>
          <p className="text-xs text-muted-foreground">{d.phone} · {d.state}{d.handoff ? " · needs a person" : ""}</p>
        </div>
        {d.userId && <Link className="text-xs text-primary hover:underline" href={`/customers/${encodeURIComponent(d.userId)}`}>Customer profile</Link>}
        <Button size="sm" variant="outline" className="ml-auto" onClick={resolve}><CheckCheck className="h-3.5 w-3.5" aria-hidden /> Mark done</Button>
      </div>
      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {d.messages.map((m) => (
          <div key={m.id} className={cn("max-w-[80%] rounded-2xl px-3 py-2 text-sm", m.direction === "out" ? "ml-auto bg-primary text-primary-foreground" : "bg-muted")}>
            {m.body ?? `[${m.type}]`}
            {m.mediaUrl && <a href={m.mediaUrl} target="_blank" rel="noreferrer" className="block text-xs underline">Attachment</a>}
            {m.orderId && <Link href={`/orders/${encodeURIComponent(m.orderId)}`} className="block text-xs underline">Order</Link>}
            <span className="mt-1 block text-[10px] opacity-70">{m.createdAt && formatDateTime(m.createdAt)}{m.handledBy ? ` · ${m.handledBy}` : ""}{m.status ? ` · ${m.status}` : ""}</span>
          </div>
        ))}
        <div ref={end} />
      </div>
      <form className="flex gap-2 border-t border-border p-3" onSubmit={(e) => { e.preventDefault(); void send(); }}>
        {!d.windowOpen && <p className="w-full text-xs text-warning">More than 24 hours since the customer wrote. WhatsApp only allows an approved template message now.</p>}
        <label className="flex-1">
          <span className="sr-only">Reply</span>
          <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Type a reply…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }} />
        </label>
        <Button type="submit" className="self-end" disabled={busy || !text.trim()}><Send className="h-4 w-4" aria-hidden /> Send</Button>
      </form>
    </div>
  );
}

function BroadcastDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [templateName, setTemplateName] = useState("");
  const [language, setLanguage] = useState("en");
  const [params, setParams] = useState("{{name}}");
  const [audience, setAudience] = useState<"consented" | "customerIds">("consented");
  const [ids, setIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BroadcastResult | null>(null);
  useEffect(() => { if (open) setResult(null); }, [open]);
  const send = async (offset = 0) => {
    if (offset === 0 && !window.confirm(audience === "consented" ? "Send this message to every customer who agreed to WhatsApp offers?" : "Send this message to the listed customers?")) return;
    setBusy(true);
    try {
      const res = await whatsappApi.broadcast({
        templateName: templateName.trim(), language: language.trim() || "en", audience, offset,
        customerIds: audience === "customerIds" ? ids.split(/[\s,]+/).filter(Boolean) : undefined,
        params: params.trim() ? params.split("|").map((p) => p.trim()) : undefined,
      });
      setResult(res);
      toast.success(`Sent ${res.sent} of ${res.eligible}`);
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange} label="Offer message">
      <DialogContent onClose={() => onOpenChange(false)}>
        <DialogHeader>
          <DialogTitle>Send an offer message</DialogTitle>
          <DialogDescription>Only customers who agreed to WhatsApp offers receive it. The message template must be approved by WhatsApp. Up to 250 customers per send.</DialogDescription>
        </DialogHeader>
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void send(0); }}>
          <Field label="Template name" hint="lowercase_with_underscores"><Input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required pattern="[a-z0-9_]+" /></Field>
          <Field label="Language code"><Input value={language} onChange={(e) => setLanguage(e.target.value)} /></Field>
          <Field label="Body parameters" hint="Separate with |  ·  {{name}} = customer's first name"><Input value={params} onChange={(e) => setParams(e.target.value)} /></Field>
          <Field label="Audience">
            <Select value={audience} onChange={(e) => setAudience(e.target.value as typeof audience)}>
              <option value="consented">All opted-in customers</option>
              <option value="customerIds">Specific customer IDs</option>
            </Select>
          </Field>
          {audience === "customerIds" && <Field label="Customer IDs"><Textarea rows={3} value={ids} onChange={(e) => setIds(e.target.value)} /></Field>}
          {result && (
            <p role="status" className="rounded-lg bg-muted p-2 text-sm">
              Eligible {result.eligible} · sent {result.sent} · failed {result.failed} · skipped {result.skipped} · remaining {result.remaining}
            </p>
          )}
          <div className="flex justify-end gap-2">
            {result?.nextOffset != null && result.remaining > 0 && <Button type="button" variant="outline" disabled={busy} onClick={() => void send(result.nextOffset ?? 0)}>Send next batch</Button>}
            <Button type="submit" disabled={busy || !templateName.trim() || Boolean(result)}>{busy ? "Sending…" : "Send"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
