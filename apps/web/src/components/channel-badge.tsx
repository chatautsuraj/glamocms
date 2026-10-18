import { Globe, MessageCircle, Phone, PenLine, Store } from "lucide-react";
import type { Channel } from "@/lib/api/types";
import { CHANNEL_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

const STYLE: Record<Channel, { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  POS_COUNTER: { icon: Store, cls: "bg-primary/10 text-primary" },
  WEBSITE: { icon: Globe, cls: "bg-sky-500/10 text-sky-700 dark:text-sky-300" },
  WHATSAPP: { icon: MessageCircle, cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" },
  PHONE: { icon: Phone, cls: "bg-amber-500/10 text-amber-700 dark:text-amber-300" },
  MANUAL: { icon: PenLine, cls: "bg-muted text-muted-foreground" },
};

export function ChannelBadge({ channel, className }: { channel: Channel | string; className?: string }) {
  const s = STYLE[channel as Channel] ?? STYLE.MANUAL;
  const Icon = s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-xs font-medium", s.cls, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {CHANNEL_LABEL[channel as Channel] ?? channel}
    </span>
  );
}
