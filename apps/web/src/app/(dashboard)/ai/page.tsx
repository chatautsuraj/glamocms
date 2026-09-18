"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Send, Sparkles, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { TOP_CUSTOMERS, TOP_PRODUCTS } from "@/lib/mock-data";
import { formatNPR } from "@/lib/format";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "Which customers have overdue payments?",
  "Show top selling products this week",
  "What's my profit margin trend?",
  "Which SKUs are at risk of stockout?",
  "Compare Lalitpur vs Kathmandu sales",
];

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: { type: "bar"; data: { name: string; value: number }[]; label: string };
};

const MOCK_RESPONSES: Record<string, Message> = {
  overdue: {
    id: "r1",
    role: "assistant",
    content:
      "You have 3 customers with overdue invoices totaling Rs 1,58,000. Riya Gurung (INV-2843) is 1 day overdue at Rs 45,000. Priya Thapa has the highest risk score at 72.",
    chart: {
      type: "bar",
      label: "Outstanding by customer",
      data: TOP_CUSTOMERS.filter((c) => c.outstanding > 0).map((c) => ({
        name: c.area,
        value: c.outstanding,
      })),
    },
  },
  products: {
    id: "r2",
    role: "assistant",
    content:
      "Velvet Matte Lipstick · Rosewood leads with 4,850 units sold (Rs 9.7L revenue). Hydrating Skin Tint · Warm Beige is #2 but critically low at 48 units — reorder immediately.",
    chart: {
      type: "bar",
      label: "Top products by revenue",
      data: TOP_PRODUCTS.map((p) => ({ name: p.name.split(" ")[0], value: p.revenue })),
    },
  },
  default: {
    id: "r0",
    role: "assistant",
    content:
      "Based on your data: today's sales are Rs 4,87,650 (+12.4% vs yesterday). Collections are slightly behind at Rs 3,92,000. I recommend prioritizing a visit to Patan Beauty Studio — outstanding grew 28% this week.",
    chart: {
      type: "bar",
      label: "Sales by area (monthly)",
      data: TOP_CUSTOMERS.map((c) => ({ name: c.area, value: c.sales })),
    },
  },
};

function getMockResponse(query: string): Message {
  const q = query.toLowerCase();
  if (q.includes("overdue") || q.includes("payment")) return MOCK_RESPONSES.overdue;
  if (q.includes("product") || q.includes("selling") || q.includes("sku")) return MOCK_RESPONSES.products;
  return MOCK_RESPONSES.default;
}

export default function AIPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I'm your Glamo Nepal assistant. Ask about sales, stock, orders, or customers — I know your store desk context.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    await new Promise((r) => setTimeout(r, 800));
    const response = getMockResponse(text);
    setMessages((m) => [...m, { ...response, id: Date.now().toString() + "-r" }]);
    setLoading(false);
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] flex-col space-y-4">
      <PageHeader
        title="AI Assistant"
        description="Natural language insights powered by your business data"
        actions={
          <Button variant="outline" size="sm">
            <TrendingUp className="h-4 w-4" />
            Daily briefing
          </Button>
        }
      />

      <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                  <Sparkles className="h-4 w-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[80%] rounded-2xl px-4 py-3 text-sm",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p className="leading-relaxed">{msg.content}</p>
                {msg.chart && (
                  <Card className="mt-4">
                    <CardContent className="p-4">
                      <p className="mb-2 text-xs font-medium text-muted-foreground">
                        {msg.chart.label}
                      </p>
                      <div className="h-[160px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={msg.chart.data}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                            <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} tick={{ fontSize: 10 }} />
                            <Tooltip formatter={(v) => formatNPR(Number(v ?? 0))} />
                            <Bar dataKey="value" fill="#2563eb" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </motion.div>
          ))}
          {loading && (
            <div className="flex gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
                <Sparkles className="h-4 w-4 animate-pulse text-primary" />
              </div>
              <div className="rounded-2xl bg-muted px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground"
                      style={{ animationDelay: `${i * 150}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t border-border p-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => send(s)}
                className="rounded-full border border-border bg-background px-3 py-1 text-xs transition-colors hover:bg-muted"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything about your business..."
              className="min-h-[44px] resize-none"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
            />
            <Button size="icon" onClick={() => send(input)} disabled={loading}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
